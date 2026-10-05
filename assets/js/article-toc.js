// TOC active state (páginas de artículo largo: legal, sostenibilidad, noticias)
const tocLinks = document.querySelectorAll('.toc a');
if(tocLinks.length){
  const targets = Array.from(tocLinks).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const tocObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        tocLinks.forEach(l => l.classList.remove('active'));
        const match = document.querySelector('.toc a[href="#'+entry.target.id+'"]');
        if(match) match.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  targets.forEach(t => tocObserver.observe(t));
}
