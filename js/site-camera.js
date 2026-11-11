// Share one physical camera capture between the site's effects and same-origin embeds.
// Each caller receives cloned tracks, so stopping one effect does not stop the others.
(() => {
  if (!navigator.mediaDevices?.getUserMedia) return;

  let owner;
  try {
    owner = window.top;
    // Accessing location verifies that this is a same-origin embed.
    void owner.location.href;
  } catch {
    owner = window;
  }

  if (!owner.siteCamera) {
    const nativeGetUserMedia = owner.navigator.mediaDevices.getUserMedia.bind(owner.navigator.mediaDevices);
    let master = null;
    let pending = null;
    let deviceId = null;

    owner.siteCamera = {
      async request(constraints = { video: true }) {
        // Audio capture is outside this site's camera sharing flow.
        if (constraints.audio || !constraints.video) return nativeGetUserMedia(constraints);

        const requestedId = constraints.video?.deviceId?.exact || null;
        const live = master?.getVideoTracks().some(track => track.readyState === 'live');
        if (!live || (requestedId && requestedId !== deviceId)) {
          if (!pending) {
            pending = nativeGetUserMedia(constraints).then(stream => {
              master?.getTracks().forEach(track => track.stop());
              master = stream;
              deviceId = stream.getVideoTracks()[0]?.getSettings().deviceId || requestedId;
              return stream;
            }).finally(() => { pending = null; });
          }
          await pending;
        } else if (pending) {
          await pending;
        }

        return master.clone();
      }
    };

    owner.addEventListener('pagehide', () => {
      master?.getTracks().forEach(track => track.stop());
      master = null;
    });
  }

  // p5's createCapture and the native renderers use the same camera owner.
  navigator.mediaDevices.getUserMedia = constraints => owner.siteCamera.request(constraints);
})();
