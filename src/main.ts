import { Plugin } from 'obsidian'

export default class ImageCaptions extends Plugin {
  observer: MutationObserver

  async onload () {
    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((rec: MutationRecord) => {
        if (rec.type === 'childList') {
          (<Element>rec.target)
            // Search for all .image-embed nodes. Could be <div> or <span>
            .querySelectorAll('.image-embed')
            .forEach(container => {
              const img = container.querySelector('img')
              const captionText = container.getAttribute('alt') || ''
              if (!img) return
              if (container.querySelector('figure')) {
                // Node has already been processed
                // Check if the text needs to be updated
                const figCaption = container.querySelector('figcaption')
                if (figCaption && captionText !== img.dataset.caption) {
                  // Set the caption text
                  figCaption.innerText = captionText
                }
              } else {
                if (img && captionText !== container.getAttribute('src')) {
                  const figure = container.createEl('figure')
                  figure.addClass('image-captions-figure')
                  figure.appendChild(img)
                  figure.createEl('figcaption', {
                    text: captionText,
                    cls: 'image-captions-caption'
                  })
                }
              }
              // Store the caption value so we can check for changes
              img.dataset.caption = captionText // our location to store the caption
            })
        }
      })
    })
    this.observer.observe(document.body, {subtree: true, childList: true})
  }

  onunload () {
    this.observer.disconnect()
  }
}
