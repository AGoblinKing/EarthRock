![logo](https://earthrock.run/weave/demo/img/logo.gif)

# Quick Start
Navigate to [https://earthrock.run](https://earthrock.run) and have fun.

## Spaces
Paths beyond the URL https://earthrock.run make a unique SPACE. SPACE sticks around between reloads by storing in a local database.

```
https://earthrock.run/this is a SPACE
https://earthrock.run/?this is also a SPACE
```

The default space is "" nothing.

## Github Cloning
Paths comprised of three / deliminated sections will be considered a Github path.

```
https://earthrock.run/agoblin/s/camera
```

This clones the SEED file from https://github.com/agoblin/s/master/camera.jpg and is a SPACE itself. You can also clone a  github repository into any SPACE by typing +agoblin/s/camera into the top most OMNI box. This doesn't keep it in sync automatically like the direct link does.

## Seeds
You can download a SEED from any WEAVE by pressing the icon on the right most on the WEAVE name banner.

If you store these on a github repository you can then link them as detailed above.

# EarthRock
  EarthRock is the first Isekai realm. It takes place 2000 years in the future on Venus after Mars and Earth destroy each other. The debris have collected into a thick net around Venus preventing space travel. Three species remain. Asgardian survivors from Mars, Midgardians from Earth, and the first settlers of Venus the self-aware quantum AI Dwarves.

SEE [LORE](/LORE.md)

# Isekai
Isekai is a Reactive Game Engine (RGE) or that it reacts to value changes to create new values.

```
Imagine having two values.

  /sys/time/tick - (what tick it is)
  /sys/camera/position - (what position the camera is at)
```

These values change as outside forces interact with them. Time moves forward or a user presses a key.
We keep these values in a location defined as /{weave}/{section}/{name}.

```
/sys/key/keys

  weave: sys
  section: camera
  name: position
```

So lets update our camera position every time the tick changes using the THREADS language.

```
/sys/camera/tick;
v3_add($/sys/camera/position, [0, 0, 1]) => /sys/camera/position
```

Whew. We will explain THREADS later but this reacts to any tick change and then adds [0,0,1] to the current camera position but doesn't react to change from camera position. This is important or it would create a loop of constantly updating the camera position. It then takes that value and writes it to /sys/camera/position.

THREADS hang off of STITCHES which looks a bit like this...

![demo](https://earthrock.run/weave/demo/img/demo.png)
