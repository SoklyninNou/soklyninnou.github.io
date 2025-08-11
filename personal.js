function shareFunction() {
    const copyText = "https://soklyninnou.github.io/personal";

    navigator.clipboard.writeText(copyText).then(() => {
        showToast("Copied website link!");
    }).catch(err => {
        showToast("Failed to copy website link.");
        console.error(err);
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";

    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
    }, 1000); // disappears after 3 seconds
}

function inputText() {
    const text = document.getElementById("inputText").value;
}

function burgerMenu() {
    var x = document.getElementById("burger-menu");
    x.classList.toggle("show");
}

function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const arrow = dropdown.previousElementSibling.querySelector(".arrow");

    dropdown.classList.toggle("show");

    if (dropdown.classList.contains("show")) {
        arrow.textContent = "▲";
    } else {
        arrow.textContent = "▼";
    }

    // Close other dropdowns
    const allDropdowns = document.querySelectorAll(".dropdown-content");
    allDropdowns.forEach((item) => {
        if (item !== dropdown && item.classList.contains("show")) {
            item.classList.remove("show");
            item.previousElementSibling.querySelector(".arrow").textContent = "▼";
        }
    });
}



const fein = new Audio('audio/fein.mp3');
const carelessWhisper = new Audio('audio/careless-whisper.mp3');
let currentAudio = null;
function play(audio) {
    if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
  
    // Toggle play/pause on the clicked audio
    if (audio.paused) {
        audio.play();
        currentAudio = audio;
    } else {
        audio.pause();
        audio.currentTime = 0;
        currentAudio = null;
    }
}

let videoSource = "video-memes/mambo.mp4";
function playVideo(newSource) {
    const videoElement = document.getElementById("myVideo");
    const videoSourceElement = document.getElementById("videoSource");
    
    videoSource = newSource;  // Update the video source variable
    videoSourceElement.src = newSource;  // Update the <source> element's src attribute

    // Reload the video to apply the new source
    videoElement.load();
    videoElement.play();
}

function research() {
    showToast("This feature is not available yet.");
}

function experience() {
    showToast("This feature is not available yet.");
}

function timer() {
    showToast("This feature is not available yet.");
}

function noteTaking() {
    showToast("This feature is not available yet.");
}