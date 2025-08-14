let videoSource = "video-memes/mambo.mp4";
function playVideo(newSource) {
    const videoElement = document.getElementById("myVideo");
    const videoSourceElement = document.getElementById("videoSource");
    
    videoSource = newSource;
    videoSourceElement.src = newSource;

    videoElement.load();
    videoElement.play();
}