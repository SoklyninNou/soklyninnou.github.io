function shareFunction() {
    const copyText = "https://soklyninnou.github.io";

    navigator.clipboard.writeText(copyText).then(() => {
        showToast("Copied website link!");
    }).catch(err => {
        showToast("Failed to copy website link.");
        console.error(err);
    });
}

function github() {
    href = 'https://github.com/SoklyninNou'
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";

    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
    }, 1000);
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

function toggle(buttonName) {
    const button = document.getElementsByClassName('button')[0];

    button.classList.add('pressed');

    setTimeout(() => {
        button.classList.remove('pressed');
    }, 320);

    setTimeout(() => {
        window.location.href = `${buttonName}.html`;
    }, 620);
}

function downloadFile(button) {
    button.classList.add('pressed');

    setTimeout(() => {
        button.classList.remove('pressed');

        const link = document.createElement('a');
        link.href = "notes/eecs127_notes.pdf";
        link.download = "eecs127_notes";
        link.click();
    }, 300);
}

function goto(page) {
    window.location.href = `${page}.html`;
}