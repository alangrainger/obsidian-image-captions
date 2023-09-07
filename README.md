![](https://img.shields.io/github/license/alangrainger/obsidian-image-captions) ![](https://img.shields.io/github/v/release/alangrainger/obsidian-image-captions?style=flat-square) ![](https://img.shields.io/github/downloads/alangrainger/obsidian-image-captions/total)

# Add image captions

Add an image in this format:

```markdown
![[image.jpg|This is a caption]]
```

or this format:

```markdown
![This is a caption](image.jpg)
```

and it will add the caption underneath the image, like this:

![](example.png)

## Resize images

You can use the existing Obsidian width parameter to resize your images:

```markdown
![[image.jpg|This is a caption|150]]
```

or this format:

```markdown
![This is a caption|150](image.jpg)
```

## Use filename as caption

If you want to use the image filename as the caption, specify `%` as your caption, and it will
replace that with the filename (without extension):

```markdown
![[image.jpg|%]]
```

If you want to literally use the `%` character as the caption, you can escape it:

```markdown
![[image.jpg|\%]]
```

If you want the filename including extension, use `%.%`.

## Styling

You can apply CSS styling by targeting the `.image-captions-figure` and `.image-captions-caption` classes.

## Limitations

The captions won't show for external images in **Editing** mode. For example:

```markdown
![Not visible in Editing mode](https://obsidian.md/logo.png)
```

I couldn't find a reliable way of targeting them. Get in touch if you know a way to do this!

---

This plugin is based on concepts from https://github.com/bicarlsen/obsidian_image_caption
