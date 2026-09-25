const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('[data-delay]').forEach((element) => {
  element.style.setProperty('--delay', `${element.dataset.delay}ms`);
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const dialog = document.querySelector('.lightbox');
const dialogImage = dialog?.querySelector('img');

document.querySelectorAll('.image-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (!dialog || !dialogImage) return;
    dialogImage.src = button.dataset.full;
    dialogImage.alt = button.querySelector('img')?.alt || '系统截图';
    dialog.showModal();
  });
});

dialog?.querySelector('.lightbox-close')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

const releaseLink = document.querySelector('#release-link');
if (releaseLink && location.hostname.endsWith('github.io')) {
  const owner = location.hostname.split('.')[0];
  const repository = location.pathname.split('/').filter(Boolean)[0];
  releaseLink.href = `https://github.com/${owner}/${repository}/releases/latest`;
} else if (releaseLink) {
  releaseLink.href = '#run';
  releaseLink.addEventListener('click', (event) => event.preventDefault());
}
