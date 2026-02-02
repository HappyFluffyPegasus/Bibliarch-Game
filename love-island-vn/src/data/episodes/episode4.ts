import type { Episode } from "@/types";

export const episode4: Episode = {
  id: "ep4",
  title: "First Recoupling",
  subtitle: "Day 5 -- Boys' Choice",
  background: "/backgrounds/villa-night.png",
  mood: "night",
  beats: [
    // ===== OPENING =====
    {
      type: "narration",
      text: "Day 5. The villa has settled into its rhythms -- Luke cooks, Nana steals food off plates, Ellie shows up and says nothing, Emmy screams about everything. But tonight, the rhythm breaks.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Tonight is the first recoupling. Boys' choice. And every single person in this villa can feel the tension like humidity before a storm.",
      style: "emotion",
    },

    // ===== PRE-RECOUPLING: GETTING READY =====
    {
      type: "transition",
      text: "Getting Ready",
      background: "/backgrounds/villa-night.png",
      mood: "night",
    },
    {
      type: "narration",
      text: "The dressing room is chaos. Hair straighteners, borrowed dresses, three arguments about mirror space, and one girl who refuses to participate.",
      style: "action",
      onScreen: [],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "Who's nervous? I'm not nervous. Why would I be nervous? I'm not even in a couple. There's nothing to lose. I have NOTHING to lose.",
      expression: "*grooming herself in the mirror with suspicious intensity*",
      spriteVariant: "happy",
      onScreen: ["nana"],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "...Do I look okay though?",
      expression: "*turning to absolutely no one, tail swishing*",
      spriteVariant: "happy",
      onScreen: ["nana"],
    },

    // --- DAMIAN GETTING READY ---
    {
      type: "narration",
      text: "Damian is sitting on the edge of his bed. His hands are shaking so hard the bed frame is rattling.",
      style: "action",
      focusCharacter: "damian",
      onScreen: ["damian"],
    },
    {
      type: "dialogue",
      characterId: "damian",
      text: "What if she doesn't-- what if I say the wrong-- what if my voice does that thing where it--",
      expression: "*trembling visibly, staring at his own hands like they've betrayed him*",
      onScreen: ["damian"],
    },
    {
      type: "narration",
      text: "Amaya walks past. She squeezes his shoulder without slowing down. Doesn't say a word. She doesn't need to.",
      style: "action",
      onScreen: ["damian", "amaya"],
    },
    {
      type: "narration",
      text: "Damian's trembling slows. Just a little.",
      style: "emotion",
      focusCharacter: "damian",
      onScreen: ["damian"],
    },

    // --- SERENITY & EMMY ---
    {
      type: "dialogue",
      characterId: "serenity",
      text: "If this is the part where someone picks me for 'romance,' I'm leaving. Through the wall. Through the FLOOR if I have to.",
      expression: "*arms crossed, back against the wall, radiating murder*",
      onScreen: ["serenity"],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "SERENITY YOU LOOK SO PRETTY TONIGHT!!",
      expression: "*screaming at a frequency that rattles the windows*",
      onScreen: ["serenity", "emmy"],
    },
    {
      type: "dialogue",
      characterId: "serenity",
      text: "Say that louder and I'll make sure it's the last thing you ever say.",
      expression: "*not even looking at her*",
      onScreen: ["serenity", "emmy"],
    },

    // --- XAVIER PRACTICING ---
    {
      type: "narration",
      text: "In the boys' bathroom, Xavier is practicing in the mirror. His eyes are already wet.",
      style: "action",
      focusCharacter: "xavier",
      onScreen: ["xavier"],
    },
    {
      type: "dialogue",
      characterId: "xavier",
      text: "I choose Serenity because... because she's...",
      expression: "*voice cracking, tears welling up before he even finishes the sentence*",
      onScreen: ["xavier"],
    },
    {
      type: "narration",
      text: "He can't get through it. He's been trying for twenty minutes. The mirror is fogging up from his crying.",
      style: "action",
      onScreen: ["xavier"],
    },

    // --- LUKE GETTING READY (WATCHING IN SECRET) ---
    {
      type: "narration",
      text: "Luke is in the boys' dressing area. He's changed his shirt three times. He's currently staring at a fourth option.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "It doesn't matter what I wear. I don't care. This is fine. Whatever.",
      spriteVariant: "flustered",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "He changes into the fourth shirt. Stares at himself. Changes back to the second one. His ears are already red and the ceremony hasn't even started.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "Aaron walks through the room, already dressed, not having thought about it for even one second.",
      style: "action",
      onScreen: ["luke", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "You've been getting dressed for forty minutes.",
      expression: "*not even looking at Luke*",
      onScreen: ["luke", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "I have NOT! I just-- the lighting in here is weird! You can't tell what color things are!",
      spriteVariant: "flustered",
      onScreen: ["luke", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "They're all black.",
      expression: "*walking out*",
      onScreen: ["luke", "aaron"],
    },
    {
      type: "narration",
      text: "They are, in fact, all black. Luke puts his face in his hands.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },

    // --- ELLIE GETTING READY (WATCHING IN SECRET) ---
    {
      type: "narration",
      text: "Ellie is sitting on her bed. She's wearing the same thing she'd wear any other night. She hasn't touched a straightener. Hasn't borrowed a dress. Hasn't argued about mirror space.",
      style: "action",
      focusCharacter: "ellie",
      onScreen: ["ellie"],
    },
    {
      type: "narration",
      text: "She's reading. Or she's pretending to read. The page hasn't turned in seven minutes.",
      style: "emotion",
      focusCharacter: "ellie",
      onScreen: ["ellie"],
    },
    {
      type: "dialogue",
      characterId: "amaya",
      text: "You sure you don't want to--",
      expression: "*gesturing at the chaos of the dressing room*",
      onScreen: ["ellie", "amaya"],
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "I'm fine.",
      spriteVariant: "talking",
      onScreen: ["ellie", "amaya"],
    },
    {
      type: "narration",
      text: "Two words. Flat. Final. Amaya knows her sister well enough to hear the third word underneath: nervous.",
      style: "emotion",
      focusCharacter: "amaya",
      onScreen: ["ellie", "amaya"],
    },
    {
      type: "narration",
      text: "Amaya squeezes her shoulder -- the same way she did for Damian -- and walks away. Ellie's fingers tighten on the book. Just for a second. Then they relax. Page turns.",
      style: "emotion",
      focusCharacter: "ellie",
      onScreen: ["ellie"],
    },

    // ===== THE RECOUPLING CEREMONY =====
    {
      type: "transition",
      text: "THE FIRST RECOUPLING -- Boys' Choice",
      background: "/backgrounds/villa-night.png",
      mood: "night",
    },
    {
      type: "narration",
      text: "The firepit. Night. Sixteen islanders gathered in a semicircle. The fairy lights feel less whimsical tonight and more like stage lighting for an execution.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "{player} steps forward as Host. The boys line up on one side. The girls on the other. This is it.",
      style: "action",
    },

    // --- LUKE PICKS ELLIE ---
    {
      type: "narration",
      text: "{player} calls the first boy forward. Luke stands. He shoves his hands in his pockets, pulls them out, shoves them back in. His jaw is clenched so hard you can see the muscle working.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "He stares at the ground. Then at the sky. Then at a very specific patch of grass that has done nothing wrong.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "I... whatever. Ellie. I pick Ellie.",
      spriteVariant: "flustered",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "His face is completely red. Not partially. Not a little flushed. Completely, devastatingly, unmistakably crimson. He's trying so hard to look casual that he's achieved the exact opposite of casual.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "She's... she doesn't... I mean, she's not the worst person to be around. Or whatever.",
      spriteVariant: "flustered",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "He's dying. He is visibly dying in front of sixteen people and a firepit.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "She eats my cooking. And she... she shows up. Every morning. She just shows up.",
      spriteVariant: "flustered",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "His voice goes quiet on the last part. The bluster falls away for exactly one sentence, and what's underneath is so raw it makes the firepit feel intimate.",
      style: "emotion",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "WOOOOO!! HE'S SO RED!! LOOK AT HIM!! GET IT, LUKE!!",
      expression: "*wolf-whistling so loud the sound bounces off the villa walls*",
      spriteVariant: "happy",
      onScreen: ["luke", "nana"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "NANA I SWEAR TO--",
      spriteVariant: "flustered",
      onScreen: ["luke", "nana"],
      onScreenVariants: { nana: "happy" },
    },
    {
      type: "narration",
      text: "Ellie stands. She walks to Luke's side with the same energy she uses to walk to the kitchen counter every morning. Measured. Unhurried. Like this was always going to happen and she saw no reason to make a fuss about it.",
      style: "action",
      focusCharacter: "ellie",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "She doesn't say anything. She just stands next to him. Close. Closer than she needs to. Their arms are touching.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Luke looks down at where their arms are touching. Looks away. Looks back. His face somehow gets even redder.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "Okay.",
      spriteVariant: "talking",
      onScreen: ["luke", "ellie"],
      onScreenVariants: { luke: "flustered" },
    },
    {
      type: "narration",
      text: "One word. But she's standing close enough that her shoulder is pressed against his arm, and she doesn't move away. That's not nothing. From Ellie, that's everything.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },

    // --- TRISTAN PICKS KYLIE ---
    {
      type: "narration",
      text: "{player} calls Tristan forward. He stands. Doesn't hesitate.",
      style: "action",
      focusCharacter: "tristan",
      onScreen: ["tristan"],
    },
    {
      type: "dialogue",
      characterId: "tristan",
      text: "Kylie.",
      expression: "*zero hesitation, no speech, just her name -- like it's the most obvious answer in the world*",
      onScreen: ["tristan"],
    },
    {
      type: "narration",
      text: "No explanation. No flowery words. Just her name. The firepit has never heard a more efficient recoupling speech. These two have been circling each other since long before the villa. The answer was decided before the question was asked.",
      style: "action",
      onScreen: ["tristan", "kylie"],
    },
    {
      type: "dialogue",
      characterId: "kylie",
      text: "Best answer I've heard all night.",
      expression: "*standing, walking over with the confidence of someone who knew this was coming since before the show started*",
      onScreen: ["tristan", "kylie"],
    },

    // --- DAMIAN PICKS AMAYA ---
    {
      type: "narration",
      text: "{player} calls Damian. He stands. It takes him a moment because his legs are shaking.",
      style: "action",
      focusCharacter: "damian",
      onScreen: ["damian"],
    },
    {
      type: "dialogue",
      characterId: "damian",
      text: "A-Amaya.",
      expression: "*voice shaking, hands clenched at his sides to stop the trembling*",
      onScreen: ["damian"],
    },
    {
      type: "dialogue",
      characterId: "damian",
      text: "Because she... she didn't laugh at me.",
      expression: "*the quietest, most fragile sentence the firepit has ever heard*",
      onScreen: ["damian"],
    },
    {
      type: "narration",
      text: "The villa goes quiet. Actually quiet. Even Nana doesn't make a sound.",
      style: "emotion",
      onScreen: ["damian"],
    },
    {
      type: "narration",
      text: "Amaya walks over. She takes his hand. Squeezes. His trembling stops for exactly three seconds.",
      style: "emotion",
      onScreen: ["damian", "amaya"],
    },
    {
      type: "dialogue",
      characterId: "amaya",
      text: "I never would.",
      expression: "*quiet, just for him*",
      onScreen: ["damian", "amaya"],
    },

    // --- AARON PICKS EMMY ---
    {
      type: "narration",
      text: "{player} calls Aaron. He stands up like he's been asked to take out the trash.",
      style: "action",
      focusCharacter: "aaron",
      onScreen: ["aaron"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "Emmy. She's alright.",
      expression: "*shrugging with his entire body, as if the concept of romance is mildly inconvenient*",
      onScreen: ["aaron"],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "ALRIGHT?! I'm AMAZING!! I'm the BEST thing that's EVER happened to this VILLA!!",
      expression: "*leaping to her feet, voice hitting frequencies that test the structural integrity of the firepit*",
      onScreen: ["aaron", "emmy"],
    },
    {
      type: "narration",
      text: "The ghost of a smile crosses Aaron's face. Blink and you'd miss it. Emmy does not blink. She sees it. She will remember it forever.",
      style: "emotion",
      onScreen: ["aaron", "emmy"],
    },

    // --- EZRIEL PICKS LIANA ---
    {
      type: "narration",
      text: "{player} calls Ezriel. He rises slowly. The weight of four centuries in every step.",
      style: "action",
      focusCharacter: "ezriel",
      onScreen: ["ezriel"],
    },
    {
      type: "dialogue",
      characterId: "ezriel",
      text: "I choose Liana.",
      expression: "*the quietest, most loaded statement the firepit has ever heard -- 400 years compressed into three words*",
      onScreen: ["ezriel"],
    },
    {
      type: "narration",
      text: "That's it. Three words. No explanation needed. Everyone in this villa who knows their story understands. Everyone who doesn't can feel it anyway.",
      style: "emotion",
      onScreen: ["ezriel", "liana"],
    },
    {
      type: "narration",
      text: "Liana smiles. The golden glow around her brightens -- just enough that the fairy lights flicker in response.",
      style: "emotion",
      onScreen: ["ezriel", "liana"],
    },

    // --- XAVIER PICKS SERENITY ---
    {
      type: "narration",
      text: "{player} calls Xavier. He stands. He's already crying.",
      style: "action",
      focusCharacter: "xavier",
      onScreen: ["xavier"],
    },
    {
      type: "dialogue",
      characterId: "xavier",
      text: "I-I choose Serenity.",
      expression: "*voice cracking, tears streaming freely down his face*",
      onScreen: ["xavier"],
    },
    {
      type: "dialogue",
      characterId: "xavier",
      text: "Because even though she scares me -- and she REALLY scares me -- she's the bravest person I've ever met.",
      expression: "*wiping his eyes with both hands and failing completely*",
      onScreen: ["xavier"],
    },
    {
      type: "narration",
      text: "Xavier is beaming through his tears. Serenity mouths 'help me' directly at the camera.",
      style: "action",
      onScreen: ["xavier", "serenity"],
    },
    {
      type: "dialogue",
      characterId: "serenity",
      text: "I want it on record that I did not consent to this.",
      expression: "*already calculating exit strategies, mapping every wall she could walk through*",
      onScreen: ["xavier", "serenity"],
    },

    // --- MARCUS AND REMAINING ---
    {
      type: "narration",
      text: "The remaining boys step forward one by one. Marcus picks with quiet authority. The others shuffle into pairs -- some comfortable, some awkward, all uncertain.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "When it's over, Erena is standing alone. She wasn't picked. She doesn't look surprised.",
      style: "emotion",
      focusCharacter: "erena",
      onScreen: ["erena"],
    },
    {
      type: "narration",
      text: "She glances across the firepit at Celestine, who is pointedly not looking back. Erena shrugs it off. Tucks her hands in her pockets. She's fine. It's just a recoupling.",
      style: "emotion",
      onScreen: ["erena"],
    },

    // ===== POST-RECOUPLING: PLAYER CHOICE =====
    {
      type: "transition",
      text: "After the Recoupling",
      background: "/backgrounds/villa-night.png",
      mood: "night",
    },
    {
      type: "narration",
      text: "The ceremony is over. Couples drift off in pairs. Some are talking. Some are silent. Some are already arguing. As Host, you make the rounds.",
      style: "action",
      onScreen: [],
    },
    {
      type: "choice",
      prompt: "Who do you check in on after the recoupling?",
      repeatable: true,
      finishText: "Head inside for the night.",
      onScreen: [],
      choices: [
        {
          text: "Luke & Ellie -- they're on the balcony.",
          characterId: "ellie",
          relationshipChanges: { ellie: 3, luke: 2 },
          reaction:
            "You find them on the balcony. Ellie is reading -- or holding a book open, at least. Luke is sitting next to her. Not three feet away this time. Right next to her. Their shoulders are touching. He's looking at the sky. She's looking at the page. Neither of them is processing what they're supposed to be looking at. Luke sees you approach and immediately scoots six inches away. 'We're not-- I was just-- the VIEW is good from here, okay?!' Ellie doesn't move. Doesn't acknowledge the sudden gap. She turns a page. Then, without looking up: 'The view is better from this side.' Luke goes absolutely scarlet. He scoots back. The gap closes. Their shoulders touch again. He stares at the stars like they've personally wronged him. She turns another page. You're pretty sure she's been on the same chapter for an hour.",
        },
        {
          text: "Damian -- he looks like he might cry (happy tears).",
          characterId: "damian",
          relationshipChanges: { damian: 3 },
          reaction:
            "Damian is sitting on the steps, hands finally still for the first time all night. The trembling has stopped completely. He's staring at his own palms like they belong to someone else -- someone who doesn't shake. 'She said she never would,' he says quietly. 'Laugh at me, I mean. Nobody's ever said that before.' He looks up at you. His eyes are shining, but it's different from Xavier's constant waterfall. This is one tear, held back, trembling on the edge. 'My parents used to say I needed to stop being afraid. Like it was a switch I could flip. Amaya just... holds my hand until the shaking stops.' He flexes his fingers. Steady. 'She doesn't try to fix me. She just stays.' For once, the trembling has nothing to do with fear. It's gratitude, and it looks almost the same, but it feels completely different.",
        },
        {
          text: "Serenity -- she's sitting as far from Xavier as physically possible.",
          characterId: "serenity",
          relationshipChanges: { serenity: 3 },
          reaction:
            "Serenity has relocated to the absolute furthest corner of the garden. You check your phone -- yes, she's actually mapped the villa and found the geometric point of maximum distance from Xavier. He's on the other side of the villa, giving her space. She can still hear him sniffling from here. 'He cried,' she says flatly. 'He cried because he thinks I'm BRAVE. I threatened to break his kneecaps yesterday.' She picks at the grass. 'The day before that I told him his face was structurally offensive.' Another blade of grass, torn in half. 'He called that feedback and said he'd work on it.' Silence. 'Why does he keep being nice to me? What's wrong with him?' She doesn't look at you. But she doesn't leave either. And you notice she's facing the direction Xavier is in, even from the furthest possible distance.",
        },
        {
          text: "Erena -- she didn't get picked again.",
          characterId: "erena",
          relationshipChanges: { erena: 3 },
          reaction:
            "Erena is sitting by the pool, feet in the water, watching the fairy lights reflect on the surface. She looks relaxed. Calm, even. 'Oh, hey,' she says, like you just bumped into each other at a coffee shop. 'Yeah, no partner. It's whatever.' She kicks the water idly. 'I just don't really get Celestine right now, honestly. We were best friends for six years. Since we were kids. She was the first person who ever wanted to hang out with me on purpose.' Another kick. Ripple. 'I left her a totally normal note yesterday. Like, hey, want to talk. And she ripped it up in front of everyone.' She shakes her head, genuinely puzzled. 'I'm not mad. I just don't understand what I did. She won't even tell me.' She looks up at you. No forced smile. No performance. Just a girl who's confused about why her best friend is acting like she's a stranger.",
        },
        {
          text: "Aaron & Emmy -- they're by the fire.",
          characterId: "aaron",
          relationshipChanges: { aaron: 2, emmy: 2 },
          reaction:
            "They're sitting by the dying firepit. Emmy is talking. Obviously. But quieter than usual. Not quiet -- Emmy doesn't do quiet -- but the volume has dropped from 'stadium concert' to 'aggressive indoor voice.' Aaron is leaning back, arms behind his head, staring at the sky. He hasn't said a word in four minutes. 'And THEN I told him the bug was probably more scared of me, which is what my mom used to say, but I don't think bugs HAVE fear, do they? Like neurologically? Do bugs have neurons?' Aaron: 'Some do.' Emmy gasps. 'Aaron knows about BUG BRAINS.' Aaron almost smiles. Almost. 'I know about a lot of things.' Emmy: 'That is SO attractive oh my GOD.' Aaron's ears turn the faintest shade of pink. He does not acknowledge this. He will never acknowledge this.",
        },
      ],
    },

    // ===== CLOSING =====
    {
      type: "narration",
      text: "The villa settles into its new configuration. Couples on daybeds. Whispered conversations through bedroom walls. The fairy lights hum overhead like they're keeping score.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Some pairs fit together like they were always meant to. Luke and Ellie on the balcony, shoulders touching, neither willing to name what's happening. Damian and Amaya, her hand still holding his steady. Kylie and Tristan, a partnership years in the making that's only now being spoken aloud.",
      style: "emotion",
    },
    {
      type: "narration",
      text: "Some pairs are held together by duct tape and mutual confusion. Xavier and Serenity. Aaron and Emmy. A force of nature paired with someone who just... shrugs.",
      style: "action",
    },
    {
      type: "narration",
      text: "And Erena is by the pool, feet in the water, not making a scene about it. She asked a simple question. She still hasn't gotten an answer.",
      style: "emotion",
      focusCharacter: "erena",
    },
    {
      type: "narration",
      text: "Tomorrow, a text arrives that changes everything. Half the villa is about to be ripped away from the other half.",
      style: "whisper",
    },
    {
      type: "narration",
      text: "Couples will be tested. Loyalties will be questioned. And the distance will reveal what proximity never could.",
      style: "whisper",
    },
  ],
};
