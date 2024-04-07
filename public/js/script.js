
    console.log("Script is running!");
    
    
    document.addEventListener('DOMContentLoaded', () => {
      const editbtn2 = document.querySelectorAll('.custom-editbtn');
      editbtn2.forEach(button => {
        button.addEventListener('click', async () => {
          const noteId = button.dataset.noteId;
          try {
            const response = await fetch(`/user/note/${noteId}`);
            const showPageContent = await response.text();
            const showPageContainer = document.createElement('div');
            showPageContainer.innerHTML = showPageContent;
            showPageContainer.classList.add('show-page-container');
            document.body.appendChild(showPageContainer);
            showPageContainer.style.height = '98vh';
            showPageContainer.style.left = '50%';
            showPageContainer.style.transform = 'translateX(-50%)';
            showPageContainer.style.position = 'fixed';
            showPageContainer.style.overflow = 'hidden';
            showPageContainer.style.top = '0';
            showPageContainer.style.zIndex = '9999';
            showPageContainer.style.width = '85%';
            showPageContainer.style.overflowY = 'auto'; 
            document.querySelector('.container').style.filter = 'blur(5px)';
            document.querySelector('nav').style.filter = 'blur(5px)';
            const crossButton = document.createElement('button');
            crossButton.innerHTML = '✖️';  
            crossButton.classList.add('close-btn');
            showPageContainer.appendChild(crossButton);
            
            crossButton.addEventListener('click', () => {
              document.body.removeChild(showPageContainer);
              document.querySelector('.container').style.filter = 'none';
            document.querySelector('nav').style.filter = 'none';
            });
          } catch (error) {
            console.error('Error fetching show page content:', error);
          }
        });
      });
    });

 

    