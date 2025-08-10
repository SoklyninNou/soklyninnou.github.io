function myFunction() {
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