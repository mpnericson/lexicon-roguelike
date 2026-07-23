# Background images

Drop image files (PNG / JPG / WebP) into this folder, then reference them from
`examples/drift-presets.js` as `backgrounds/<filename>`.

Example — after adding `wood.jpg` here:

```js
myPreset: {
  image: 'backgrounds/wood.jpg',
  params: { driftSpeed: 0.12, warp: 0.16, /* … */ },
},
```

Then view it non-interactively at:

```
http://localhost:3000/examples/drift-background.html?preset=myPreset
```

`sample.png` is a copy of `res/preview.png`, used by the built-in presets so they
work out of the box. Images are cover-fit to the screen automatically.
