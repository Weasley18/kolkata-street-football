# পাড়ার ফুটবল — Kolkata Street Football

A 3D three-a-side street football game set on a caged concrete court in a Kolkata neighbourhood (*para*): old houses with louvred shutters, a tea stall, a sweet shop, the para club, hand-painted wall writing in Bengali, a carrom board and a yellow taxi at the kerb.

It is a single web page. Everything is drawn in code: there are no image or model files.

## Play

Open `index.html` in a modern desktop browser. It needs WebGL, a keyboard and an internet connection (three.js and the fonts load from CDNs).

First team to 5 goals wins.

| | Keys |
|---|---|
| Move | `W` `A` `S` `D` or the arrow keys |
| Shoot, or tackle when you don't have the ball | `Space` (or `Enter`) |
| Pass to the teammate you are facing | `F` (or right `Shift`) |
| Pause | `Esc` |
| First person | `W` `A` `S` `D` run and sidestep, `←` `→` (or `Q` `E`) turn; click the court to look with the mouse |

## Modes

- **Player vs CPU**: side-on camera. You play whichever of your two outfielders has the ball or is nearest it; your keeper and the other outfielder look after themselves.
- **First person**: you see through one kid's eyes and stay as that kid. Everyone else is CPU.

The CPU opponent has three levels, Easy, Medium and Hard, chosen on the start screen.

## How the game works

- The ball stays at a kid's feet once they reach it. Run into the carrier's ball from the front or side to win it or knock it loose; a carrier can shield it with their body.
- A hard shot comes off a defender instead of being trapped. Keepers hold what they can reach and parry the rest.
- The ball flies, bounces and loses pace on each bounce; the court is a cage, so it never leaves play.
- Each side is a keeper, a back and a forward. Whichever CPU outfielder is nearer the ball presses it; the back otherwise covers the line between the ball and his goal, and the forward alternates between holding the width and slanting runs in behind.

## Code

```
index.html          the playable page (markup, styles, and the script below embedded)
src/1-game.js       rules, input, physics, CPU players, online sync (see below)
src/2-textures.js   procedural textures: shop fronts, the painted wall, the court
src/3-scene.js      three.js scene, characters, animation, cameras, main loop
build.sh            re-embeds src/ into index.html after an edit
```

The online two-player code is still in `src/1-game.js`, but the mode has no button on the start screen: it needs the connection that Claude gives its published artifacts, so it cannot work on an ordinary web host.

The three source files are one script split for reading: they share a single scope and are joined in order by `build.sh`.

Libraries: [three.js r128](https://threejs.org/) from cdnjs. Fonts: Anek Bangla, Anek Latin and Galada from Google Fonts.
