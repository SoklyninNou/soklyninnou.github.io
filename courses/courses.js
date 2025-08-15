function toggleTeaching() {
    const legend = document.getElementById('teaching');
    const teachingCourses = document.querySelectorAll('.item#teaching');
    const firstItem = document.querySelector('.item#teaching');

    legend.classList.toggle('show');
    
    firstItem.classList.toggle('show');
    teachingCourses.forEach(item => {
        item.classList.toggle('show');
    });
}
