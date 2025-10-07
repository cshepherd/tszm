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

I am pleased to report we have a roadmap.

## What's Next (05-Oct-2025, 100% Probability)
I've always wanted to write my own Z-Machine, and this one is starting to work really well after just one week's effort! I could stop here and be pretty happy with myself. But then again, I'm not so sure, because the _product_ has a lot of potential and with another week of hard work, I think this could truly push the envelope of Interactive Fiction. With that in mind, here's what we gotta do before I'll be ready to claim "release quality," and it's happening this week, baby:
- Refactor and unit test coverage: DONE
- Game Master: An exciting new chunk of architecture will sit betweeen the Z-Machine and the ZMCDN. The Game Master will take "inside information" (since we control the Z-Machine after all) in addition to text output to formulate an intelligent JSON prompt to the ZMCDN, resulting in fewer unnecessary images, and much higher illustrative accuracy.

**Partially done, with Qwen3-32B serving as Game Master / Art Director, and FLUX-1-schnell serving as illustrator, for fractions of pennies!** See the sample below.

<img width="806" height="520" alt="image" src="https://github.com/user-attachments/assets/309c4904-40f4-4d4e-b65d-d7cacb17d46b" />

07-Oct-2025 - Preview of the above "Art Director Pattern":

`curl https://cshepherd.fr/samplenew.txt`

07-Oct-2025 - [Online coverage report from CI](https://cshepherd.github.io/tszm/coverage/)


## What's Next Next (After That, 75% Probability)
- Voice Changer: The Art Director can optionally change the text narrator's voice if we want, while remaining faithful to the story line. If you want Snoop or Walken to narrate the story, let's do it. Note that this opens the door for machine translation as well. Let's bring IF classics to non-English speakers.
- Speech Mode: Enter commands as speech and the narrator talks back to you, for interactive fiction during roadtrips. It's a long drive from Florida to Maine, why not play Hitchhiker's Guide to keep you mentally sharp while you drive? Will require cheap Text-to-Speech and Speec-to-Text models, but I'm up for it.

The above points just sound cool as hell.

## Credits
- @cshepherd
- @chad3814 (readline sanity, code review, some tooling)
- @clambertus (CI action for coverage reporting)
- Design credit: Jay Craft once asked what it'd look like if we hooked an image generation AI up to a ZMachine, so I generally blame him for this
