<template>
    <div class="vid">
      <video ref="videoPlayer" class="video-js vjs-default-skin" controls></video>
    </div>
  </template>
  
  <script>
  import videojs from 'video.js';
  import 'video.js/dist/video-js.css';
  import plyr from 'vue-plyr';
  
  export default {
    props: {
      url: {
        type: String,
        required: true
      }
    },
    mounted() {
      const options = {
        autoplay: false,
        controls: true,
        fluid: true,
        sources: [{
          src: this.url,
          type: 'application/x-mpegURL' // HLS MIME type
        }]
      };
  
      this.player = videojs(this.$refs.videoPlayer, options, function onPlayerReady() {
        console.log('Player is ready');
      });
    },
    beforeUnmount() {
      if (this.player) {
        this.player.dispose();
      }
    }
  };
  </script>
  
  <style lang="scss" scoped>
  .vid {
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 3.5em;
    overflow: hidden;
    background-position: center;
    background-size: cover;
    width: 100%;
    height: 100%;
    border-radius: 6px;
  }
  </style>