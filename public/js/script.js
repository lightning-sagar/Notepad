
    console.log("Script is running!"); // Add this line
    const addNoteIcon = document.querySelector('.add-note-icon');
    const tcentre = document.querySelector('.tcentre');
    document.addEventListener('DOMContentLoaded', () => {
      tcentre.addEventListener('click', () => {
        window.location.href = '/user/${req.user._id}/new';
      });
  
      addNoteIcon.addEventListener('click', () => {
        window.location.href = '/user/${req.user._id}/new';
      });
    });
  
    function getRandomColor() {
      // Generate a random hex color code
      return '#' + Math.floor(Math.random()*16777215).toString(16);
    }

 