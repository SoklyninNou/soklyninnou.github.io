function toggleHonors() {
    const legend = document.getElementById('honors-legend');
    const teachingCourses = document.querySelectorAll('.honors');

    legend.classList.toggle('off');

    teachingCourses.forEach(item => {
        item.classList.toggle('hide');
    });
}

function toggleMaths() {
    const legend = document.getElementById('maths-legend');
    const teachingCourses = document.querySelectorAll('.maths');

    legend.classList.toggle('off');

    teachingCourses.forEach(item => {
        item.classList.toggle('hide');
    });
}

function toggleCompsci() {
    const legend = document.getElementById('compsci-legend');
    const teachingCourses = document.querySelectorAll('.compsci');

    legend.classList.toggle('off');

    teachingCourses.forEach(item => {
        item.classList.toggle('hide');
    });
}

function togglePhysics() {
    const legend = document.getElementById('physics-legend');
    const teachingCourses = document.querySelectorAll('.physics');

    legend.classList.toggle('off');

    teachingCourses.forEach(item => {
        item.classList.toggle('hide');
    });
}

function toggleTeaching() {
    const legend = document.getElementById('teaching-legend');
    const teachingCourses = document.querySelectorAll('.teaching');

    legend.classList.toggle('off');

    teachingCourses.forEach(item => {
        item.classList.toggle('hide');
    });
}

function toggleElectives() {
    const legend = document.getElementById('electives-legend');
    const teachingCourses = document.querySelectorAll('.electives');

    legend.classList.toggle('off');

    teachingCourses.forEach(item => {
        item.classList.toggle('hide');
    });
}