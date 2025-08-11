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

function dropDown() {
    var dropdown = document.getElementById("dropdown-content");
    var arrow = document.getElementById("arrow");
    dropdown.classList.toggle("show");
    arrow.textContent = dropdown.classList.contains("show") ? "▲" : "▼";
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