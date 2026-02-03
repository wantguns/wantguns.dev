window.onload = function () {
  let container = document.querySelector('#toc-aside');
  if (container != null) {
    toc_scroll_position(container);
    window.onscroll = function () { toc_scroll_position(container) };
  }
  addBackLinks();
  addCopyButtons();
}

function toc_scroll_position(container) {
  if (container.offsetParent === null) {
    // skip computation if ToC is not visible
    return;
  }

  // remove active class for all items
  for (item of container.querySelectorAll("li")) {
    item.classList.remove("active");
  }

  // look for active item
  let site_offset = document.documentElement.scrollTop;
  let current_toc_item = null;
  for (item of container.querySelectorAll("li")) {
    if (item.offsetParent === null) {
      // skip items that are not visible
      continue;
    }
    let anchor = item.firstElementChild.getAttribute("href");
    let heading = document.querySelector(anchor);
    if (heading.offsetTop <= (site_offset + document.documentElement.clientHeight / 3)) {
      current_toc_item = item;
    } else {
      break;
    }
  }

  // set active class for current ToC item
  if (current_toc_item != null) {
    current_toc_item.classList.add("active");
  }
}

// This adds links back to where a footnote is originally referenced.
const addBackLinks = () => {
  for (const ref of document.getElementsByClassName('footnote-reference')) {
    const hash = ref.children[0].hash.substring(1);
    const refhash = 'ref:' + hash;
    ref.id = refhash;
  }

  for (const footnote of document.getElementsByClassName('footnote-definition')) {
    const hash = footnote.id;
    const refhash = 'ref:' + hash;
    const backlink = document.createElement('a');

    backlink.href = '#' + refhash;
    backlink.className = 'footnote-backlink';
    backlink.innerText = '↩︎';

    sup = footnote.children[1];
    sup.appendChild(backlink);
  }
}

// This adds copy buttons to all code blocks
const addCopyButtons = () => {
  const preElements = document.querySelectorAll('pre');

  preElements.forEach(pre => {
    // Create a wrapper div that will contain both the pre and the button
    const wrapper = document.createElement('div');
    wrapper.className = 'pre-wrapper';
    wrapper.style.position = 'relative';
    
    // Replace the pre with the wrapper
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    
    // Create the copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'copy';

    // Add click event listener
    copyButton.addEventListener('click', () => {
      // Get the code content
      const code = pre.querySelector('code');
      const textToCopy = code ? code.textContent : pre.textContent;

      // Copy to clipboard
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          // Visual feedback
          copyButton.textContent = 'copied!';
          copyButton.classList.add('copied');

          // Reset after 2 seconds
          setTimeout(() => {
            copyButton.textContent = 'copy';
            copyButton.classList.remove('copied');
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          copyButton.textContent = 'error!';

          setTimeout(() => {
            copyButton.textContent = 'copy';
          }, 2000);
        });
    });

    // Add the button to the wrapper (not the pre)
    wrapper.appendChild(copyButton);
  });
}
