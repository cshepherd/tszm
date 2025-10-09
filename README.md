# TSZM

> TypeScript-based Inform/Z-Machine interpreter

## Features

- Abstractable input/output permitting the engine to be used in a variety of environments (console, web, others)
- Support for the upcoming ZMCDN AI/LLM based enhancements for Interactive Fiction
- Compatibility with z1-z6 (except text-windowing, graphics, sound)

## Current Status
05-Oct-2025: "Naive" ZMCDN image generation works. We ship raw scene information off to gpt-image-1 and get an image to display in sixel format. For a demo, run this in [iTerm2](https://iterm2.com) or other sixel-compatible terminal:
`curl https://cshepherd.fr/sample2.txt`

06-Oct-2025: The Great Refactor happened. Trace output is much nicer and more complete, and tracing itself can be toggled in-game with `/trace on` and `/trace off`. And yes, we now have unit test coverage. Compatibility: z3 should be completely playable, working on z4/z5 now, but most effort is focusing on ZMCDN where the Game Master and Illustrator LLMs play.

07-Oct-2025 - [Online coverage report from CI](https://cshepherd.github.io/tszm/coverage/)

09-Oct-2025: Improving Unit Test coverage, but meanwhile ZMCDN is more complete and caches almost everything. When we don't get everything quite right though, you can `/redraw` and force ZMCDN to invalidate its cache and try again.

Public zmcdn server is at zmcdn.ballmerpeak.org:3003

<img width="806" height="520" alt="image" src="https://github.com/user-attachments/assets/309c4904-40f4-4d4e-b65d-d7cacb17d46b" />

We're squashing a couple bugs and upgrading compatibility to .z4 next, but there's still more to come! You need to be able to enjoy interactive fiction during long roadtrips.

## What's Next
- Speech Mode: Enter commands as speech and the narrator talks back to you, for interactive fiction during roadtrips. It's a long drive from Florida to Maine, why not play Hitchhiker's Guide to keep you mentally sharp while you drive? Will require cheap Text-to-Speech and Speec-to-Text models, but I'm up for it.
- Voice Changer: The Art Director can optionally change the text narrator's voice if we want, while remaining faithful to the story line. If you want Snoop or Walken to narrate the story, let's do it. Note that this opens the door for machine translation as well. Let's bring IF classics to non-English speakers.

## Credits
- @cshepherd
- @chad3814 (readline sanity, code review, some tooling)
- @clambertus (CI action for coverage reporting)
- Design credit: Jay Craft once asked what it'd look like if we hooked an image generation AI up to a ZMachine, so I generally blame him for this
