import type { Episode } from "@/types";

export const episode6: Episode = {
  id: "ep6",
  title: "The Aftermath",
  subtitle: "Day 9 — Stick or Switch",
  background: "/backgrounds/villa-night.png",
  mood: "night",
  beats: [
    // ===== OPENING =====
    {
      type: "narration",
      text: "Casa Amor is over. The villa feels like it's holding its breath.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Tonight is the Stick or Switch ceremony. Every islander who walked into that second villa now has to stand at the firepit and answer one question: did you stay loyal, or did you find someone new?",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "The fairy lights are on. The firepit is burning. Everyone is gathering. {player}, it's time.",
      style: "whisper",
      onScreen: [],
    },

    // ===== THE CEREMONY BEGINS =====
    {
      type: "transition",
      text: "The Stick or Switch Ceremony",
      background: "/backgrounds/villa-night.png",
      mood: "night",
    },
    {
      type: "narration",
      text: "One by one, the islanders who stayed in the villa stand on one side of the firepit. The ones returning from Casa Amor will walk through the doors. If they're alone, they stuck. If they're with someone new, they switched.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "The first door opens.",
      style: "whisper",
      onScreen: [],
    },

    // ===== LUKE & ELLIE REUNION =====
    {
      type: "transition",
      text: "Couple 1 — Luke & Ellie",
    },
    {
      type: "narration",
      text: "Ellie is standing at the firepit. She's holding Luke's photo. Her grip on it is tight — white-knuckle tight. She hasn't looked up from it in three minutes. She hasn't acknowledged she's holding it at all.",
      style: "action",
      focusCharacter: "ellie",
      onScreen: ["ellie"],
    },
    {
      type: "narration",
      text: "The door opens. Luke walks out. Alone.",
      style: "action",
      onScreen: ["ellie"],
    },
    {
      type: "narration",
      text: "He's trying to look casual. Hands in pockets. Jaw set. Expression carefully neutral. He takes two steps and sees her standing there with his photo and his hoodie still knotted around her waist.",
      style: "action",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "His face goes red. Immediately. Completely. From his neck to the tips of his ears. He tries to stop it. He cannot stop it.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "He's trying not to smile. He is failing catastrophically at not smiling.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "Hey. I— cool. This is. Yeah. Hey.",
      spriteVariant: "flustered",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "Ellie looks up. Face neutral. Perfectly composed. Like she hasn't been sleeping in his spot for three days. She shifts the photo behind her back — casually, like she wasn't holding it at all.",
      style: "action",
      focusCharacter: "ellie",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "She doesn't let go of it. She just hides it.",
      style: "whisper",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "Hey.",
      spriteVariant: "talking",
      onScreen: ["ellie", "luke"],
      onScreenVariants: { luke: "flustered" },
    },
    {
      type: "narration",
      text: "That's it. One word. Perfectly flat. But she hasn't stopped looking at him since he walked through the door.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "So you're— that's my hoodie. You're wearing my— not that I CARE, I just— is that—",
      spriteVariant: "flustered",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "It was on the chair.",
      spriteVariant: "talking",
      onScreen: ["ellie", "luke"],
      onScreenVariants: { luke: "flustered" },
    },
    {
      type: "narration",
      text: "Luke opens his mouth. Closes it. Opens it again. His ears are so red they're practically glowing. He runs a hand through his hair and looks away, but he can't keep his eyes off her for more than two seconds.",
      style: "action",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "I made your— I mean I cooked. At the other villa. Not FOR you. Just food. General food. That happened to be—",
      spriteVariant: "flustered",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "Okay.",
      spriteVariant: "flustered",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "Her voice cracks on the word. Just barely. If you weren't listening for it, you'd miss it. Luke was listening for it. His whole face softens.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "I'M NOT CRYING, YOU'RE CRYING!!!",
      expression: "*sobbing from somewhere behind the daybed, completely inconsolable*",
      spriteVariant: "happy",
      onScreen: ["ellie", "luke", "nana"],
      onScreenVariants: { ellie: "flustered", luke: "flustered" },
    },
    {
      type: "narration",
      text: "Luke steps forward. Not much. Just enough. Ellie doesn't step back. They stand there, close, not touching, both pretending this isn't the most relieved either of them has ever been.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "He knew her before the show. He's been into her for longer than anyone in this villa realizes. And he still can't say it out loud. And she still won't let go of his photo.",
      style: "whisper",
      onScreen: ["ellie", "luke"],
    },

    // ===== DAMIAN & AMAYA REUNION =====
    {
      type: "transition",
      text: "Couple 2 — Damian & Amaya",
    },
    {
      type: "narration",
      text: "Amaya is next. She's standing at the firepit with her arms crossed, tapping her foot. Not nervous. Impatient.",
      style: "action",
      focusCharacter: "amaya",
      onScreen: ["amaya"],
    },
    {
      type: "narration",
      text: "The door opens. Damian walks out. His hands are shaking. His whole body is shaking. He opens his mouth to say something—",
      style: "action",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "Amaya doesn't wait. She runs at him. Full sprint. No hesitation.",
      style: "action",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "He catches her. Arms around her, lifting her off the ground for half a second before setting her down. It's the first time Damian hasn't flinched from physical contact.",
      style: "emotion",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "amaya",
      text: "You're shaking.",
      expression: "*holding his arms, looking up at him*",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "damian",
      text: "Happy shaking.",
      expression: "*trembling, but smiling — genuinely smiling*",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "amaya",
      text: "There's a difference?",
      expression: "*laughing softly*",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "damian",
      text: "There is now.",
      expression: "*the trembling slows, just a little*",
      onScreen: ["amaya", "damian"],
    },

    // ===== TRISTAN & KYLIE REUNION =====
    {
      type: "transition",
      text: "Couple 3 — Tristan & Kylie",
    },
    {
      type: "narration",
      text: "Kylie is leaning against the firepit like she's waiting for a bus. She knows exactly what's about to happen.",
      style: "action",
      focusCharacter: "kylie",
      onScreen: ["kylie"],
    },
    {
      type: "narration",
      text: "Tristan walks out. Hands in pockets. Face unreadable.",
      style: "action",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "dialogue",
      characterId: "kylie",
      text: "You hacked the results, didn't you.",
      expression: "*smirking, arms crossed*",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "dialogue",
      characterId: "tristan",
      text: "Obviously.",
      expression: "*the faintest curve of a smile*",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "dialogue",
      characterId: "kylie",
      text: "Did I stick?",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "dialogue",
      characterId: "tristan",
      text: "Obviously.",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "dialogue",
      characterId: "kylie",
      text: "Good answer.",
      expression: "*extending a fist*",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "narration",
      text: "They fist bump. In Kylie and Tristan's world, that's basically a proposal.",
      style: "action",
      onScreen: ["kylie", "tristan"],
    },

    // ===== AARON & EMMY REUNION =====
    {
      type: "transition",
      text: "Couple 4 — Aaron & Emmy",
    },
    {
      type: "narration",
      text: "Emmy is vibrating. Literally vibrating. She's been standing at the firepit for thirty seconds and has already bitten through two fingernails.",
      style: "action",
      focusCharacter: "emmy",
      onScreen: ["emmy"],
    },
    {
      type: "narration",
      text: "The door opens. Aaron walks out.",
      style: "action",
      onScreen: ["emmy"],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "AAAAROOOON!!!",
      expression: "*a scream so loud the firepit flickers — possibly the loudest sound produced in this villa's history, and that's saying something*",
      onScreen: ["emmy"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "Hey.",
      expression: "*shrugs*",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "Emmy is shaking. Full body trembling. Not the performative kind — the real kind. The kind that comes from three days of not knowing.",
      style: "emotion",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "Aaron looks at her. Really looks. Something flickers behind his eyes — brief, barely there. He steps forward and puts one hand on her shoulder. Steady. Grounding.",
      style: "emotion",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "I'm here.",
      expression: "*voice low, just for her*",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "Two words. From Aaron, that's a soliloquy. Emmy stops shaking. She grabs his arm and doesn't let go for the rest of the night.",
      style: "emotion",
      onScreen: ["emmy", "aaron"],
    },

    // ===== OTHER REUNIONS =====
    {
      type: "transition",
      text: "The Remaining Couples",
    },
    {
      type: "narration",
      text: "One by one, the rest file through. Every single couple stuck. Every single one.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Ezriel and Liana share a look when he walks out. A look that spans centuries. 400 years of distance, and neither of them wavered for a second.",
      style: "emotion",
      onScreen: ["ezriel", "liana"],
    },
    {
      type: "narration",
      text: "Serenity doesn't react when Xavier comes out. Xavier tears up immediately. She rolls her eyes. But she doesn't leave.",
      style: "action",
      onScreen: ["serenity", "xavier"],
    },
    {
      type: "narration",
      text: "Marcus walks out with a nod. Steady. Uncomplicated. The kind of person who made a decision and never second-guessed it.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Not a single switch. Not one. Casa Amor threw everything it had at them, and every islander walked back alone.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "The villa exhales.",
      style: "whisper",
      onScreen: [],
    },

    // ===== CELEBRATION — MORNING AFTER =====
    {
      type: "transition",
      text: "The next morning...",
      background: "/backgrounds/villa-day.png",
      mood: "golden-hour",
    },
    {
      type: "narration",
      text: "Morning light floods the villa. There's something different in the air. Lighter. Relief has settled over everything like warm water.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Nana is napping in a cardboard box in a patch of sunlight by the kitchen. She found it behind the storage room last night and has claimed it as sovereign territory.",
      style: "action",
      focusCharacter: "nana",
      onScreen: ["nana"],
    },
    {
      type: "dialogue",
      characterId: "serenity",
      text: "We survived that? Barely.",
      expression: "*leaning against the kitchen counter, arms crossed, watching the villa come to life*",
      onScreen: ["serenity"],
    },
    {
      type: "dialogue",
      characterId: "xavier",
      text: "I'm just happy you're still here.",
      expression: "*sitting next to her, genuine hope in his eyes*",
      onScreen: ["serenity", "xavier"],
    },
    {
      type: "dialogue",
      characterId: "serenity",
      text: "I'm here because the exits are monitored.",
      expression: "*not looking at him*",
      onScreen: ["serenity", "xavier"],
    },
    {
      type: "narration",
      text: "Xavier doesn't flinch. He's used to it. He also doesn't stop sitting next to her. He's used to that too.",
      style: "action",
      onScreen: ["serenity", "xavier"],
    },

    // ===== ERENA & CELESTINE REUNION =====
    {
      type: "transition",
      text: "Meanwhile, by the pool...",
    },
    {
      type: "narration",
      text: "Celestine returns from her morning walk around the villa grounds. She's carrying her parasol, her face as unreadable as ever.",
      style: "action",
      focusCharacter: "celestine",
      onScreen: ["celestine"],
    },
    {
      type: "narration",
      text: "Erena spots her from across the pool. She stands up and walks over.",
      style: "action",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "She stops a few feet away. Casual. Giving Celestine space, the way Liana suggested.",
      style: "emotion",
      focusCharacter: "erena",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "Hi.",
      expression: "*standing still, hands clasped in front of her, voice steady for the first time*",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "Just 'hi.' Normal. Easy. A girl standing by a pool, saying hello to someone she missed.",
      style: "emotion",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "dialogue",
      characterId: "celestine",
      text: "...Move.",
      expression: "*walking past her*",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "But she walked slower than usual. And she didn't raise the parasol. That's new.",
      style: "thought",
      onScreen: ["erena"],
    },
    {
      type: "narration",
      text: "Erena stands by the pool, watching her go. She's still smiling. Small and a little confused, but real.",
      style: "emotion",
      focusCharacter: "erena",
      onScreen: ["erena"],
    },

    // ===== CELEBRATION MONTAGE =====
    {
      type: "transition",
      text: "The rest of the morning...",
      background: "/backgrounds/villa-day.png",
      mood: "golden-hour",
    },
    {
      type: "narration",
      text: "The villa settles into something that almost looks like peace. Luke is cooking breakfast for everyone. Ellie is at the kitchen counter.",
      style: "action",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "She's not reading. She's just sitting there, chin in hand, watching him cook. She's not going to acknowledge that she's watching him. She doesn't need to. Everyone can see it.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "I made— here. Just eat.",
      spriteVariant: "flustered",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "He slides a plate to her without looking at her. It's her favorite. Eggs with tomatoes. Exactly how she likes it. His ears are red.",
      style: "action",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "Thanks.",
      spriteVariant: "flustered",
      onScreen: ["ellie", "luke"],
      onScreenVariants: { luke: "flustered" },
    },
    {
      type: "narration",
      text: "She eats. Every bite. Doesn't comment on it. Doesn't analyze it. Just eats, quietly, in his space, where she's been sitting since he left. Luke watches her eat from the corner of his eye and pretends he isn't.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Damian is sitting on the daybed. He hasn't stopped smiling since last night. Amaya is next to him, painting her nails like nothing happened. But every few seconds, she bumps her shoulder against his.",
      style: "action",
      onScreen: ["damian", "amaya"],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "AARON! AARON! TELL THEM WHAT YOU SAID WHEN YOU SAW ME! TELL THEM!",
      expression: "*bouncing around the villa, physically unable to contain herself*",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "I said 'hey.'",
      expression: "*shrugs*",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "HE SAID 'HEY'!!! WITH FEELING!!! THERE WAS FEELING IN IT!!!",
      expression: "*grabbing the nearest person and shaking them*",
      onScreen: ["emmy", "aaron"],
    },

    // ===== PLAYER CHOICE — WHO TO CELEBRATE WITH =====
    {
      type: "choice",
      prompt: "The villa is celebrating. Who do you spend time with?",
      repeatable: true,
      finishText: "Head inside.",
      onScreen: [],
      choices: [
        {
          text: "Luke & Ellie — she's eating, he's cooking. Classic.",
          characterId: "ellie",
          relationshipChanges: { ellie: 2, luke: 2 },
          reaction:
            "You sit at the kitchen counter. Luke slides you a plate without being asked — he's already made enough for everyone. Ellie is eating silently, methodically, like she hasn't had a proper meal in three days. She probably hasn't. Luke keeps glancing at her plate. 'Is it— do you want more—' She holds up a hand without looking at him. 'It's fine.' She takes another bite. 'It's good.' Luke goes completely red and turns back to the stove. She takes another bite. Her ears are pink too. Neither of them acknowledges any of this.",
        },
        {
          text: "Amaya & Damian — he's still smiling.",
          characterId: "damian",
          relationshipChanges: { amaya: 2, damian: 2 },
          reaction:
            "You join them on the daybed. Damian is still trembling slightly, but it's the good kind. The kind that comes from feeling too much at once. Amaya: 'He hasn't let go of my hand in four hours.' Damian: 'It's been three.' Amaya: 'Felt like four.' He doesn't let go.",
        },
        {
          text: "Emmy — she's still screaming about Aaron.",
          characterId: "emmy",
          relationshipChanges: { emmy: 3 },
          reaction:
            "Emmy grabs you by the shoulders. 'HE WALKED FAST, {player}! HE WALKED FAST OUT OF THAT DOOR! That's basically Aaron proposing!' You point out that walking fast isn't a proposal. She disagrees at a volume that rattles the windows. Aaron walks past, shrugs, and keeps going. Emmy: 'SEE?! HE SHRUGGED NEAR ME! ON PURPOSE!'",
        },
        {
          text: "Nana — she found a bigger box.",
          characterId: "nana",
          relationshipChanges: { nana: 3 },
          reaction:
            "You find Nana behind the kitchen. She's found a second, larger box. She's sitting inside it with a blanket and a juice box. 'This one has better acoustics,' she says, completely serious. You sit on the floor next to her. She purrs. Then catches herself. 'I didn't purr. That was the fridge.'",
        },
        {
          text: "Spy on Luke at the counter.",
          characterId: "luke",
          relationshipChanges: { luke: 2 },
          reaction:
            "You linger by the hallway where Luke can't see you. He's done cooking for everyone else. He's making one more plate. A smaller one, with extra care. He arranges it three times. He puts a little garnish on top, then takes it off, then puts it back on. He's blushing the entire time. 'It's just FOOD,' he says to nobody. 'I make food for EVERYONE.' He carries the plate to where Ellie is sitting and sets it down without a word. It's seconds. Her favorite dessert from their neighborhood back home. She looks at it. Looks at him. He's already walking away, ears burning. She eats every bite.",
        },
        {
          text: "Watch Ellie when she thinks nobody's looking.",
          characterId: "ellie",
          relationshipChanges: { ellie: 2 },
          reaction:
            "You catch Ellie after breakfast, when the kitchen clears out. Luke's hoodie is still tied around her waist. She's standing at the counter where he was cooking, running her fingers along the edge of it. She picks up the mug he was drinking from. Holds it for a second. Sets it back down in exactly the same spot, like she's preserving a crime scene. Then she sits back in her seat — his usual spot at the counter, the one she's claimed since he left — and opens her book. She actually reads this time. But her free hand rests on the counter, exactly where his was. She would deny everything about this if asked.",
        },
      ],
    },

    // ===== CLOSING =====
    {
      type: "transition",
      text: "That evening...",
      background: "/backgrounds/villa-night.png",
      mood: "night",
    },
    {
      type: "narration",
      text: "The sun goes down. The villa is quiet in a way it hasn't been since Day 1. Not empty quiet. Full quiet. The kind that comes from everyone being exactly where they chose to be.",
      style: "emotion",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Luke and Ellie are on the balcony again. Same spot. Same silence. But Luke is sitting so close their shoulders are almost touching. He's pretending it's because 'the other chair is broken.' It is not broken.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Ellie hasn't moved away. She hasn't acknowledged it either. She's just sitting there, reading, in his hoodie, shoulder-to-shoulder with the person she'll never admit she missed for three days straight.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Damian is asleep on the daybed. His hands have finally stopped shaking. Amaya draped a blanket over him twenty minutes ago and has been sitting guard since.",
      style: "emotion",
      onScreen: ["damian", "amaya"],
    },
    {
      type: "narration",
      text: "Somewhere in the villa, Emmy is still talking about how Aaron said 'hey' with feeling. Aaron is shrugging through every retelling.",
      style: "action",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "Nana is asleep in her box.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "And Erena is by the pool. Just sitting with her feet in the water, watching the stars. On the far side of the pool, Celestine is reading under a lamp. They're not together. But they're in the same space, and neither one left.",
      style: "emotion",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "That's new.",
      style: "whisper",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Casa Amor tested them. It threw temptation and distance and doubt at every single couple in this villa. And every single couple said: no. We're good.",
      style: "thought",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Relief. Warmth. The kind of calm that only comes after a storm.",
      style: "whisper",
      onScreen: [],
    },
    {
      type: "narration",
      text: "But this is Love Island. And the calm never lasts.",
      style: "whisper",
      onScreen: [],
    },
  ],
};
