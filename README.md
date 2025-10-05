# TSZM

> TypeScript-based Inform/Z-Machine interpreter

## Features

- Abstractable input/output permitting the engine to be used in a variety of environments (console, web, others)
- Support for the upcoming ZMCDN AI/LLM based enhancements for Interactive Fiction
- Compatibility with z1-z6 (except text-windowing, graphics, sound)

## Current Status
04-Oct-2025: Many compatibility fixes have been made, most games are playable. I'm currently drawing the line at text "window", graphics, and sound functionality, meaning just about all the .z3s are fine.

05-Oct-2025: "Naive" ZMCDN image generation works. We ship raw scene information off to gpt-image-1 and get an image to display in sixel format. For a demo, run this in [iTerm2](https://iterm2.com) or other sixel-compatible terminal:
`curl https://cshepherd.fr/sample2.txt`

I am pleased to report we have a roadmap.

## What's Next (05-Oct-2025, 100% Probability)
I've always wanted to write my own Z-Machine, and this one is starting to work really well after just one week's effort! I could stop here and be pretty happy with myself. But then again, I'm not so sure, because the _product_ has a lot of potential and with another week of hard work, I think this could truly push the envelope of Interactive Fiction. With that in mind, here's what we gotta do before I'll be ready to claim "release quality," and it's happening this week, baby:
- Refactor the opcodes: Look, those giant 'case' statements suck and there's a fair bit of concern-separation that needs to happen because I was more concerned with getting something working than elegance. Now I'm more concerned about elegance. Look for well-structured opcodes that are _unit tested_.
- Art Director: An exciting new chunk of architecture will sit betweeen the Z-Machine and the ZMCDN. The Art Director will take "inside information" (since we control the Z-Machine after all) in addition to text output to formulate an intelligent JSON prompt to the ZMCDN, resulting in fewer unnecessary images, and much higher illustrative accuracy.
- ZMCDN changes: With the above changes, maybe I could stick with gpt-image-1 at 13 cents per illustration, but probably the hell not. With SDXL-Turbo, for example, we get "free" images, and low enough resolution to get that chunky-pixel format that could go nicely with Interactive Fiction (Bonus: Low res images would work nicely for future Apple II ZMCDN integration, never say never).

I think the above points will take us from "meh another Z-Machine" to a reference-quality Inform implementation that leverages AI to push the envelope of Interactive Fiction. A product.

## What's Next Next (After That, 75% Probability)
- Voice Changer: The Art Director can optionally change the text narrator's voice if we want, while remaining faithful to the story line. If you want Snoop or Walken to narrate the story, let's do it. Note that this opens the door for machine translation as well. Let's bring IF classics to non-English speakers.
- Speech Mode: Enter commands as speech and the narrator talks back to you, for interactive fiction during roadtrips. It's a long drive from Florida to Maine, why not play Hitchhiker's Guide to keep you mentally sharp while you drive? Will require cheap Text-to-Speech and Speec-to-Text models, but I'm up for it.

The above points just sound cool as hell.

## Credits
- @cshepherd
- @chad3814 (readline sanity, code review)
- Design credit: Jay Craft once asked what it'd look like if we hooked an image generation AI up to a ZMachine, so I generally blame him for this
