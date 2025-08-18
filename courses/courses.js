function toggle(className) {
    const legend = document.getElementById(className + '-legend');
    const course = document.querySelectorAll(className);

    legend.classList.toggle('off');

    course.forEach(item => {
        item.classList.toggle('hide');
    });
}