import type { Episode } from "@/types";

export const episode8: Episode = {
  id: "ep8",
  title: "The Final Coupling",
  subtitle: "Day 12 \u2014 Finale",
  background: "/backgrounds/villa-night.png",
  mood: "romantic",
  beats: [
    // ============================================================
    // OPENING \u2014 THE FINAL MORNING
    // ============================================================
    {
      type: "narration",
      text: "Day 12. The last day.",
      style: "whisper",
      onScreen: [],
    },
    {
      type: "narration",
      text: "The villa is quiet in a way it hasn't been since the first morning. The pool is still. The fairy lights are off \u2014 waiting for tonight. Even the birds seem to know.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Twelve days. Sixteen people pulled from different worlds, different stories, different levels of emotional damage. And somehow, against every odd, some of them fell in love.",
      style: "emotion",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Tonight is the Final Coupling Ceremony. But first \u2014 the Letters Challenge. Each couple reads a letter to their partner. Out loud. In front of everyone.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Some of these people can barely say 'good morning' without deflecting. This is going to be devastating.",
      style: "thought",
      onScreen: [],
    },

    // ============================================================
    // MORNING MOMENTS \u2014 BEFORE THE LETTERS
    // ============================================================
    {
      type: "transition",
      text: "That morning...",
      background: "/backgrounds/villa-day.png",
      mood: "golden-hour",
    },
    {
      type: "narration",
      text: "Luke is in the kitchen. He's been up since six. He's making breakfast for everyone but he keeps burning things because his hands won't stop shaking.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "He has a folded piece of paper in his back pocket. He's been touching it every thirty seconds to make sure it's still there. He wrote the letter last night. Rewrote it. Rewrote it again. The final version is simpler than the first. Truer.",
      style: "emotion",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "Ellie walks in. She doesn't say good morning. She sits at the counter. Opens her book. Luke slides a plate toward her without turning around. She eats without commenting. They've done this every morning for twelve days. Today it means more.",
      style: "action",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "You sleep okay?",
      spriteVariant: "flustered",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "Fine.",
      onScreen: ["ellie", "luke"],
      onScreenVariants: { luke: "flustered" },
    },
    {
      type: "narration",
      text: "She didn't. She was up until 3 AM staring at the ceiling. But that's not something she's going to say.",
      style: "thought",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Nana bounces in. She takes one look at them \u2014 Luke red-faced over the stove, Ellie pretending to read, the charged silence \u2014 and her eyes fill with tears immediately.",
      style: "action",
      onScreen: ["luke", "ellie", "nana"],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "I'm FINE. I'm just\u2014 this is the LAST breakfast and you two are being DOMESTIC and I can't\u2014",
      spriteVariant: "happy",
      expression: "*already crying, gesturing at them with both hands*",
      onScreen: ["luke", "ellie", "nana"],
      onScreenVariants: { luke: "flustered", ellie: "flustered" },
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "Nana, it's just eggs\u2014",
      spriteVariant: "flustered",
      onScreen: ["luke", "nana"],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "IT'S NEVER JUST EGGS WITH YOU TWO!",
      spriteVariant: "happy",
      onScreen: ["luke", "ellie", "nana"],
    },

    // ============================================================
    // TRANSITION \u2014 LETTERS CHALLENGE
    // ============================================================
    {
      type: "transition",
      text: "THE LETTERS CHALLENGE",
      background: "/backgrounds/villa-day.png",
      mood: "golden-hour",
    },
    {
      type: "narration",
      text: "Everyone gathers by the pool. Chairs arranged in a circle. The challenge is simple: read the letter you wrote to your partner. No hiding. No deflecting.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Nana is already crying and nobody has started yet.",
      style: "action",
      onScreen: ["nana"],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "I'm FINE. I'm pre-crying. It's called being EMOTIONALLY PREPARED.",
      spriteVariant: "happy",
      onScreen: ["nana"],
    },

    // ============================================================
    // LUKE'S LETTER TO ELLIE
    // ============================================================
    {
      type: "narration",
      text: "Luke is called up first. He stands. His hands are shaking. He's holding a folded piece of paper, but he doesn't look at it.",
      style: "action",
      focusCharacter: "luke",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "His face is already red. Of course it is. He can feel everyone looking at him and every instinct is screaming to sit back down, to play it off, to say 'it's nothing' and retreat. But he doesn't.",
      style: "emotion",
      onScreen: ["luke"],
    },
    {
      type: "narration",
      text: "Ellie is sitting perfectly still. Her book is in her lap \u2014 closed. She closed her book. Everyone who knows her understands what that means.",
      style: "emotion",
      focusCharacter: "ellie",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Luke takes a breath. He doesn't unfold the paper. He knows what he wants to say. He's known since before the show, if he's honest with himself. Since that mixer where she walked past him reading and he thought: that's the one. And then spent months denying it to everyone including himself.",
      style: "action",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "I came here thinking I was the background character. The one who makes up the numbers. And then I met a girl who was reading a book while walking into a villa, and she was so focused she nearly tripped over a poolside chair, and I thought \u2014 that's the most interesting person I've ever seen.",
      spriteVariant: "flustered",
      expression: "*voice unsteady, gripping the paper like a lifeline*",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Ellie's jaw tightens. She's staring at a fixed point on the ground. Her fingers grip the edges of her book.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "I told Nana I didn't like you. I told Marcus it was nothing. I told everyone in this villa that you were just my partner and it was fine and I was fine and everything was fine.",
      spriteVariant: "flustered",
      expression: "*laughing, but his eyes are wet*",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "Nothing was fine. I've liked you since the mixer. I liked you before I even knew your name. And I spent every single day in this villa pretending I didn't because I was scared you'd think I was... too much. Or not enough. Or just... in the way.",
      spriteVariant: "flustered",
      expression: "*his voice cracks and he has to stop and breathe*",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "You didn't save me, Ellie. But you made me realize I didn't need saving. I just needed someone who'd let me be useful.",
      spriteVariant: "flustered",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "His voice cracks on 'useful.' He keeps going. Because this is the one time he's not hiding. The letter in his hand is shaking but the words aren't.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "So thanks for letting me cook you breakfast. I know you'd never admit you liked it. You did, though.",
      spriteVariant: "flustered",
      expression: "*the smallest smile through wet eyes*",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Silence.",
      style: "action",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Ellie is fighting it. She's fighting it so hard her shoulders are shaking. Her eyes are glassy. She blinks once. Twice. A tear rolls down her cheek and she wipes it away like it personally offended her.",
      style: "emotion",
      focusCharacter: "ellie",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "She loses.",
      style: "whisper",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "She opens her mouth. Nothing comes out. She tries again. Her lips move but there's no sound. She's crying \u2014 actually crying \u2014 tears running down her face, and the girl who always has a response has nothing. Not a word. Not a deflection. Not a single syllable.",
      style: "emotion",
      focusCharacter: "ellie",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "She wipes her eyes with the back of her hand. Tries one more time. Can't.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "That's it. That's her answer. The silence and the tears and the inability to speak. From the girl who always has something to say, this is louder than any word she could have chosen.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "Luke smiles. He understood. He always understands.",
      style: "emotion",
      onScreen: ["luke", "ellie"],
    },
    {
      type: "narration",
      text: "In the background, Nana is a MESS. Absolutely inconsolable. She's sobbing into a cushion she stole from the daybed.",
      style: "action",
      onScreen: ["luke", "ellie", "nana"],
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "SHE CAN'T EVEN TALK! SHE'S SO IN LOVE SHE CAN'T EVEN TALK! I CAN'T\u2014 I CAN'T\u2014",
      spriteVariant: "happy",
      onScreen: ["luke", "ellie", "nana"],
      onScreenVariants: { luke: "happy", ellie: "flustered" },
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "Nana\u2014",
      spriteVariant: "flustered",
      expression: "*wiping her face, voice cracking on just the name*",
      onScreen: ["ellie", "nana"],
      onScreenVariants: { nana: "happy" },
    },
    {
      type: "dialogue",
      characterId: "nana",
      text: "SHE CLOSED HER BOOK, EVERYONE! SHE CLOSED IT!",
      spriteVariant: "happy",
      onScreen: ["ellie", "nana"],
      onScreenVariants: { ellie: "flustered" },
    },

    // ============================================================
    // AMAYA'S LETTER TO DAMIAN
    // ============================================================
    {
      type: "narration",
      text: "Amaya stands next. She doesn't look nervous. But her hands are unusually still \u2014 she always talks with her hands. Not right now.",
      style: "action",
      focusCharacter: "amaya",
      onScreen: ["amaya"],
    },
    {
      type: "narration",
      text: "Damian is watching her. He's shaking, but that's just Damian. What's different is his eyes \u2014 they're steady.",
      style: "emotion",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "amaya",
      text: "I've worked 47 jobs. I've talked my way into and out of everything. But you're the first person I didn't have to perform for.",
      expression: "*her voice is even, deliberate \u2014 this is the most honest she's been in front of a crowd*",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "She looks directly at him. Not at the group. Just him.",
      style: "emotion",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "amaya",
      text: "You saw me be patient and didn't call it a trick. You're braver than you think, Damian. And I'm staying.",
      expression: "*the faintest tremor in her voice on 'staying' \u2014 she's never promised anyone that before*",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "Damian is shaking. But he's smiling. Really, genuinely smiling. The boy who trembled at every loud noise is sitting in front of everyone, shaking and smiling, because the girl who's never stayed anywhere just promised she'd stay for him.",
      style: "emotion",
      focusCharacter: "damian",
      onScreen: ["amaya", "damian"],
    },

    // ============================================================
    // PLAYER CHOICE \u2014 WHOSE LETTER MOVED YOU?
    // ============================================================
    {
      type: "choice",
      prompt: "Whose letter moved you most?",
      onScreen: ["luke", "ellie", "amaya"],
      choices: [
        {
          text: "Luke's letter broke me.",
          relationshipChanges: { luke: 2, ellie: 1 },
          reaction:
            "You look at Luke and Ellie \u2014 her still wiping her eyes, him still looking at her like she's the only person in the world. She couldn't speak. The girl who always has something to say sat there and cried and couldn't say a single word. Luke understood. He always understands. You're going to remember the silence more than any word she could have said.",
        },
        {
          text: "Amaya's honesty was incredible.",
          relationshipChanges: { amaya: 2, damian: 1 },
          reaction:
            "Amaya catches your eye and gives you a nod. Just a nod. But from the girl who's performed her whole life, that nod is everything. She meant every word. Damian is still shaking beside her, but his smile hasn't moved. The boy who trembles is smiling, and the girl who runs just promised to stay. That's everything.",
        },
        {
          text: "Every single one.",
          relationshipChanges: {
            luke: 1,
            ellie: 1,
            amaya: 1,
            damian: 1,
            kylie: 1,
            tristan: 1,
            aaron: 1,
            emmy: 1,
            ezriel: 1,
            liana: 1,
          },
          reaction:
            "You look around the circle. Every couple. Every letter. Every word that cost someone something to say out loud. Luke shaking through every sentence. Ellie unable to speak. Amaya promising to stay. Damian smiling through his trembling. Every second of it mattered. This is what twelve days of vulnerability looks like.",
        },
      ],
    },

    // ============================================================
    // OTHER LETTERS \u2014 BRIEF
    // ============================================================
    {
      type: "transition",
      text: "The remaining letters...",
    },
    {
      type: "narration",
      text: "Tristan stands. He pulls out a phone he definitely wasn't supposed to have.",
      style: "action",
      onScreen: ["tristan", "kylie"],
    },
    {
      type: "dialogue",
      characterId: "tristan",
      text: "I hacked into every system I've ever encountered. You're the first person I couldn't figure out. I like that.",
      expression: "*reading from his phone with the faintest smile \u2014 and pink ears*",
      onScreen: ["tristan", "kylie"],
    },
    {
      type: "dialogue",
      characterId: "kylie",
      text: "That's the most romantic thing anyone's ever said to me and I need you to know how concerning that is.",
      expression: "*grinning despite herself*",
      onScreen: ["tristan", "kylie"],
    },
    {
      type: "narration",
      text: "Aaron stands next. He doesn't have a paper. He doesn't have a phone. He has three sentences.",
      style: "action",
      onScreen: ["aaron", "emmy"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "You're loud. You're a lot. You're alright.",
      expression: "*shrugging, as if he didn't just say the most Aaron thing possible*",
      onScreen: ["aaron", "emmy"],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "AAAAAHHH!!!",
      expression: "*screaming at a frequency that shatters the concept of indoor voices*",
      onScreen: ["aaron", "emmy"],
    },
    {
      type: "narration",
      text: "He's smiling. Aaron is smiling. Emmy made Aaron smile.",
      style: "emotion",
      onScreen: ["aaron", "emmy"],
    },
    {
      type: "narration",
      text: "Ezriel is the last to stand. He has no paper. No phone. He just looks at Liana.",
      style: "action",
      focusCharacter: "ezriel",
      onScreen: ["ezriel", "liana"],
    },
    {
      type: "narration",
      text: "The man who has lived for centuries. The man who cursed himself with eternity because he couldn't let go. He's standing in front of the woman he did it all for.",
      style: "emotion",
      onScreen: ["ezriel", "liana"],
    },
    {
      type: "dialogue",
      characterId: "ezriel",
      text: "I waited 400 years. I'd wait 400 more.",
      expression: "*his voice is quiet, steady, and it carries the weight of four centuries*",
      onScreen: ["ezriel", "liana"],
    },
    {
      type: "narration",
      text: "Liana doesn't cry. Goddesses don't cry. But her hand finds his, and she holds on like she's afraid eternity might end.",
      style: "emotion",
      onScreen: ["ezriel", "liana"],
    },
    {
      type: "narration",
      text: "Nana is somehow crying harder than before. She has graduated from the cushion to lying face-down on the ground.",
      style: "action",
      onScreen: ["ezriel", "liana", "nana"],
    },

    // ============================================================
    // TRANSITION \u2014 FINAL COUPLING CEREMONY
    // ============================================================
    {
      type: "transition",
      text: "That night \u2014 The Final Coupling Ceremony",
      background: "/backgrounds/villa-night.png",
      mood: "night",
    },
    {
      type: "narration",
      text: "Night falls. The fairy lights come on \u2014 every single strand, all at once, like the villa has been saving them for this moment. The firepit is lit. The chairs are arranged in a semicircle.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Sixteen people. Twelve days. This is where it ends.",
      style: "whisper",
      onScreen: [],
    },
    {
      type: "narration",
      text: "{player} stands at the center. The Host, one last time.",
      style: "action",
      onScreen: [],
    },

    // ============================================================
    // COUPLE 1 \u2014 ELLIE & LUKE
    // ============================================================
    {
      type: "narration",
      text: "The first couple is called forward.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Ellie and Luke.",
      style: "whisper",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "Luke holds out his hand. He's red. Of course he's red. He's been red since the letters challenge. He might be permanently red at this point.",
      style: "action",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "Ellie looks at his hand. She looks at the crowd. She looks back at his hand.",
      style: "action",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "She takes it.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "For Ellie, this is the equivalent of screaming from a rooftop. This is her standing on a table and declaring it. This is everything she has. And she gives it in the quietest way possible \u2014 by taking his hand in front of everyone and not letting go.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "dialogue",
      characterId: "luke",
      text: "For the record, I always knew it wasn't logistical.",
      spriteVariant: "flustered",
      expression: "*grinning through the redness*",
      onScreen: ["ellie", "luke"],
      onScreenVariants: { ellie: "flustered" },
    },
    {
      type: "dialogue",
      characterId: "ellie",
      text: "Shut up.",
      spriteVariant: "flustered",
      onScreen: ["ellie", "luke"],
      onScreenVariants: { luke: "happy" },
    },
    {
      type: "narration",
      text: "She doesn't let go of his hand.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "In the back row, Nana is sobbing so loudly that Amaya has to physically hold a cushion over her face. Nana doesn't resist. She just sobs into it.",
      style: "action",
      onScreen: ["ellie", "luke", "nana"],
    },

    // ============================================================
    // COUPLE 2 \u2014 AMAYA & DAMIAN
    // ============================================================
    {
      type: "narration",
      text: "The second couple steps forward.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Amaya and Damian.",
      style: "whisper",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "Amaya walks forward like she's done this a thousand times. But she hasn't. She's never been this sure of anything in her life \u2014 and she's had 47 jobs to be sure about.",
      style: "emotion",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "Damian is standing. Not shaking.",
      style: "action",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "damian",
      text: "I'm not shaking.",
      expression: "*looking at his own hands with wonder, like he just discovered a new law of physics*",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "dialogue",
      characterId: "amaya",
      text: "I noticed.",
      expression: "*her smile is soft and real \u2014 no performance, no charm, just her*",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "She takes his hand. It's steady. He's steady. The boy who trembled is standing still, and the girl who ran is staying.",
      style: "emotion",
      onScreen: ["amaya", "damian"],
    },

    // ============================================================
    // COUPLE 3 \u2014 KYLIE & TRISTAN
    // ============================================================
    {
      type: "narration",
      text: "The third couple.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Kylie and Tristan walk out together. Not one after the other. Together. In sync. Like they're about to overthrow a government.",
      style: "action",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "dialogue",
      characterId: "kylie",
      text: "Ready?",
      expression: "*glancing at him sideways with a look that could topple empires*",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "dialogue",
      characterId: "tristan",
      text: "I've been ready.",
      expression: "*the faintest smirk \u2014 the one he only gives her \u2014 ears still pink*",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "narration",
      text: "They don't do the hand-holding thing. They stand shoulder to shoulder. Partners. Equals. The kind of couple that makes you check if your wifi is secure.",
      style: "action",
      onScreen: ["kylie", "tristan"],
    },

    // ============================================================
    // COUPLE 4 \u2014 EMMY & AARON
    // ============================================================
    {
      type: "narration",
      text: "The fourth couple is called.",
      style: "action",
      onScreen: [],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "THAT'S US!! THAT'S US AARON!! OH MY GOD!!",
      expression: "*already screaming before their names are fully announced*",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "...Yeah.",
      expression: "*hands in pockets, walking forward like he's being inconvenienced*",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "But then their names echo across the villa. Emmy & Aaron. And he looks at her \u2014 really looks at her \u2014 and something shifts.",
      style: "emotion",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "He's smiling. Full, genuine, unmistakable. Not a half-smile. Not an 'almost.' A real, honest, actual smile.",
      style: "emotion",
      focusCharacter: "aaron",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "Emmy made Aaron smile. Not once. Not by accident. She cracked him open with sheer, relentless, deafening joy, and he let her.",
      style: "emotion",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "emmy",
      text: "Aaron... you're SMILING. You're actually smiling!",
      expression: "*tears streaming down her face, but she's beaming*",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "dialogue",
      characterId: "aaron",
      text: "Don't make it weird.",
      expression: "*still smiling \u2014 he can't stop*",
      onScreen: ["emmy", "aaron"],
    },

    // ============================================================
    // COUPLE 5 \u2014 LIANA & EZRIEL
    // ============================================================
    {
      type: "narration",
      text: "The final couple.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Liana and Ezriel.",
      style: "whisper",
      onScreen: ["liana", "ezriel"],
    },
    {
      type: "narration",
      text: "They don't walk forward. They were already standing together. They've been standing together since the moment he saw her on Day 1 and stopped breathing.",
      style: "emotion",
      onScreen: ["liana", "ezriel"],
    },
    {
      type: "narration",
      text: "The goddess and the man who cursed himself with eternity. Four hundred years of waiting. Four hundred years of wondering if forever was a gift or a punishment.",
      style: "emotion",
      onScreen: ["liana", "ezriel"],
    },
    {
      type: "narration",
      text: "Finally, forever doesn't feel like a punishment.",
      style: "whisper",
      onScreen: ["liana", "ezriel"],
    },
    {
      type: "narration",
      text: "She rests her head on his shoulder. He closes his eyes. Centuries resolve in a single, quiet breath.",
      style: "emotion",
      onScreen: ["liana", "ezriel"],
    },

    // ============================================================
    // TRANSITION \u2014 CELEBRATION
    // ============================================================
    {
      type: "transition",
      text: "Later that night...",
      background: "/backgrounds/villa-night.png",
      mood: "romantic",
    },
    {
      type: "narration",
      text: "The ceremony is over. The villa erupts. Music. Dancing. Emmy is on someone's shoulders \u2014 it's unclear whose. Nana found a box somewhere and is sitting in it while crying happy tears.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Everyone is celebrating. Almost everyone.",
      style: "whisper",
      onScreen: [],
    },

    // ============================================================
    // THE ERENA CRASHOUT
    // ============================================================
    {
      type: "transition",
      text: "Away from the celebration...",
      mood: "night",
    },
    {
      type: "narration",
      text: "Celestine is sitting alone. Away from the music, away from the lights, away from everyone. She's on the far side of the garden, looking at nothing. Her parasol lies on the bench beside her, closed for once.",
      style: "action",
      focusCharacter: "celestine",
      onScreen: ["celestine"],
    },
    {
      type: "narration",
      text: "Footsteps. Slow. Deliberate. The same even, unhurried pace Erena has always walked with.",
      style: "action",
      onScreen: ["celestine"],
    },
    {
      type: "narration",
      text: "Erena approaches. She's not smiling. She's not waving. She's not doing the casual, friendly thing she's done every other time \u2014 the easy 'hey,' the relaxed check-in, the warmth that Celestine never deserved and got anyway.",
      style: "action",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "This is a different Erena. The patience is gone. The easy calm she's carried every single day in this villa \u2014 gone. What's left is worse. It's clarity.",
      style: "emotion",
      focusCharacter: "erena",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "She's been building to this. Not for days. For years. Every time she showed up and got shut down. Every time she tried, calmly, reasonably, and it wasn't enough. Every time she extended the same simple kindness any friend would and watched Celestine treat it like an attack. All of that patience, all of that restraint, compressed into a single point.",
      style: "emotion",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "Celestine glances up. She opens her mouth to say something dismissive, something cutting, something that will make Erena flinch and retreat. The usual routine.",
      style: "action",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "But Erena speaks first.",
      style: "whisper",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "I spent my entire childhood being told I was going to hell.",
      expression: "*standing perfectly still, voice flat and steady \u2014 unrecognizable*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Celestine blinks. This isn't the script. Erena doesn't talk like this.",
      style: "thought",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "My family made me believe that. Every day. 'You're less sinful because your magic is weak.' Like that was supposed to make me GRATEFUL.",
      expression: "*her hands are at her sides \u2014 she's not gesturing, not fidgeting, not performing*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "celestine",
      text: "Erena\u2014",
      expression: "*shifting uncomfortably, reaching for her parasol by instinct*",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "I'm talking.",
      expression: "*not raising her voice \u2014 that's what makes it terrifying*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Celestine goes silent. Erena has never spoken to her like that. In twelve days \u2014 in years before this \u2014 Erena has never raised her voice, never pushed back, never been anything other than calm and friendly. This is the first time. And that's what makes it terrifying.",
      style: "emotion",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "I told other kids they were going to hell because my family PRAISED me for it. And then I had no friends. No one. For YEARS.",
      expression: "*her voice cracks on 'years' but she pushes through it*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "The music from the celebration drifts faintly across the garden. Laughter. Cheering. It feels like it's happening in a different world.",
      style: "action",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "And the one person who made me feel like I wasn't alone was you.",
      expression: "*looking directly at Celestine \u2014 not pleading, not begging, just stating a fact*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Celestine's grip tightens on the edge of the bench.",
      style: "action",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "I left everything for you. I dropped the religion. I spent YEARS trying to reach you after you shut me out.",
      expression: "*each sentence lands like a stone dropped into still water*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "And what did I get?",
      expression: "*tilting her head slightly \u2014 waiting, but not expecting an answer*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "celestine",
      text: "...",
      expression: "*mouth slightly open, no words coming \u2014 for the first time, Celestine has nothing*",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "narration",
      text: "The silence stretches. Celestine doesn't fill it. She can't. The girl who always has a cutting remark, a dismissal, an exit strategy \u2014 she has nothing.",
      style: "emotion",
      onScreen: ["celestine", "erena"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "You are cruel to every single person who tries to care about you. Damian. Me. Everyone.",
      expression: "*her voice doesn't waver \u2014 she rehearsed this, or maybe she's just past the point of breaking*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "You push and you push and you break people and then you wonder why you're alone.",
      expression: "*stepping closer \u2014 not aggressive, just... final*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Long pause. The firepit crackles somewhere in the distance. Nobody else is close enough to hear this. This is between them. Only them.",
      style: "action",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Erena takes one breath.",
      style: "whisper",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "And she says the thing she swore she'd never say. The thing she's been carrying for years. The one weapon she always had and never used because she loved Celestine too much to use it.",
      style: "emotion",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "She doesn't love her too much anymore.",
      style: "whisper",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "dialogue",
      characterId: "erena",
      text: "You're just like your dad.",
      expression: "*quiet, level, absolute*",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Dead silence.",
      style: "whisper",
      onScreen: ["erena", "celestine"],
    },
    {
      type: "narration",
      text: "Celestine's face goes white. Not pink, not flushed \u2014 white. Drained. Like every drop of blood just left her body. Her lips part but no sound comes out. Her hand falls from the parasol.",
      style: "emotion",
      focusCharacter: "celestine",
      onScreen: ["celestine"],
    },
    {
      type: "narration",
      text: "That's the one thing you never say. That's the line nobody crosses. Everyone in Celestine's world knows it. Erena knew it better than anyone.",
      style: "emotion",
      onScreen: ["celestine"],
    },
    {
      type: "narration",
      text: "She said it anyway. Because that's what happens when you push someone past their breaking point. When you take the one person who would never hurt you and you hurt them so many times that the 'never' stops being true.",
      style: "emotion",
      onScreen: ["celestine"],
    },
    {
      type: "narration",
      text: "Erena turns around.",
      style: "action",
      focusCharacter: "erena",
      onScreen: ["erena"],
    },
    {
      type: "narration",
      text: "She walks away. Her steps are even. Her back is straight. She doesn't run. She doesn't stumble. She doesn't look over her shoulder to see if Celestine is coming after her.",
      style: "action",
      onScreen: ["erena"],
    },
    {
      type: "narration",
      text: "She doesn't look back.",
      style: "whisper",
      onScreen: ["erena"],
    },
    {
      type: "narration",
      text: "Celestine sits on the bench. The parasol beside her. The garden empty. The celebration continuing without her. Her hands are in her lap and they're shaking \u2014 not like Damian's shaking, not from anxiety. From something deeper. From the feeling of being seen clearly by someone who used to see you with love, and realizing they don't anymore.",
      style: "emotion",
      focusCharacter: "celestine",
      onScreen: ["celestine"],
    },
    {
      type: "narration",
      text: "It's over.",
      style: "whisper",
      onScreen: [],
    },

    // ============================================================
    // PLAYER CHOICE \u2014 POST-CRASHOUT REACTION
    // ============================================================
    {
      type: "choice",
      prompt: "You saw what happened. What do you do?",
      onScreen: [],
      choices: [
        {
          text: "Find Erena.",
          characterId: "erena",
          relationshipChanges: { erena: 3 },
          reaction:
            "You find Erena on the far side of the pool. She's sitting on the edge, feet in the water, staring at nothing. She doesn't look up when you sit down. A long silence. Then: 'I'm not sorry.' Her voice is even. Calm. Emptied. 'I should be. I know I should be. That was the cruelest thing I could have said to her.' Another silence. Her feet make small circles in the water. 'But I spent years being reasonable. Years showing up like a normal person, being friendly, being patient. Years trying to reach someone who treated basic kindness like a threat.' She looks at you. Her eyes are dry. 'I'm done being patient.' She looks back at the water. 'I'm just done.'",
        },
        {
          text: "Find Celestine.",
          characterId: "celestine",
          relationshipChanges: { celestine: 3 },
          reaction:
            "You find Celestine still on the bench. She hasn't moved. The parasol is beside her, untouched. She's staring at her hands. When she hears you approach, she doesn't look up. Doesn't tell you to leave. A long silence. Then, barely audible: 'My dad left when I was seven. Told my mum he didn't love her. Told ME he didn't love me. Just... walked out. Said he had better things to do.' Her voice is flat. Mechanical. Like she's reciting a fact. 'Erena knows that. She's the only one who knows that.' She picks up the parasol. Holds it across her lap. 'She's not wrong.' The quietest thing Celestine has ever said. 'That's the worst part. She's not wrong.'",
        },
        {
          text: "Stay where you are. This isn't yours.",
          reaction:
            "You stay. Some things aren't meant to be witnessed. Some things aren't meant to be fixed. You sit at the celebration and listen to the music and know that somewhere in the garden, the calmest person in this villa finally stopped being calm. It ended with five words and a walk that didn't look back.",
        },
      ],
    },

    // ============================================================
    // CLOSING NARRATION \u2014 WHERE THEY ARE NOW
    // ============================================================
    {
      type: "transition",
      text: "And so...",
      mood: "romantic",
    },
    {
      type: "narration",
      text: "The couples settle into the villa's last night. The celebration quiets. The music fades to something softer.",
      style: "action",
      onScreen: [],
    },
    {
      type: "narration",
      text: "Amaya and Damian are on the daybed. She's talking about job number 48 \u2014 she says it's the one she's keeping. He laughs. He's not shaking.",
      style: "emotion",
      onScreen: ["amaya", "damian"],
    },
    {
      type: "narration",
      text: "Kylie and Tristan are in the kitchen, hunched over his phone, planning something that will probably get them both arrested and somehow make them more in love. Tristan's ears are still pink. Kylie keeps glancing at them.",
      style: "action",
      onScreen: ["kylie", "tristan"],
    },
    {
      type: "narration",
      text: "Emmy fell asleep on Aaron's shoulder mid-sentence. He hasn't moved. He won't move. He'll sit there all night if he has to.",
      style: "emotion",
      onScreen: ["emmy", "aaron"],
    },
    {
      type: "narration",
      text: "Liana and Ezriel are by the pool, feet in the water, watching the stars. They have forever now. And for the first time, forever feels like enough.",
      style: "emotion",
      onScreen: ["liana", "ezriel"],
    },
    {
      type: "narration",
      text: "Nana is asleep in her box. Some habits never die.",
      style: "action",
      onScreen: ["nana"],
    },
    {
      type: "narration",
      text: "And somewhere in the garden, Celestine sits alone. The parasol in her lap. Her eyes dry but distant. Thinking about a girl who finally stopped coming back.",
      style: "emotion",
      focusCharacter: "celestine",
      onScreen: [],
    },

    // ============================================================
    // FINAL FAREWELL
    // ============================================================
    {
      type: "narration",
      text: "{player}, your time as Host is over.",
      style: "whisper",
      onScreen: [],
    },
    {
      type: "narration",
      text: "The villa falls quiet. The fairy lights dim, one strand at a time, like the building is closing its eyes. The firepit cools. The pool stills. Twelve days of chaos and heartbreak and laughter and love, settling into something permanent.",
      style: "emotion",
      onScreen: [],
    },
    {
      type: "narration",
      text: "But somewhere on a balcony, a girl is reading a book. And the boy sitting next to her has never felt more at home.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "He's red. She's not looking at him. Their hands are touching between them on the cushion and neither will be the first to acknowledge it.",
      style: "emotion",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "That's enough. For them, that's everything.",
      style: "whisper",
      onScreen: ["ellie", "luke"],
    },
    {
      type: "narration",
      text: "Thank you for watching.",
      style: "whisper",
      onScreen: [],
    },

    // ============================================================
    // FINAL PLAYER CHOICE \u2014 REFLECTION
    // ============================================================
    {
      type: "choice",
      prompt: "One last thought before the lights go out...",
      onScreen: [],
      choices: [
        {
          text: "This was everything.",
          reaction:
            "It was. Every fight, every letter, every silence that said more than words. Every time Luke turned red. Every time Ellie didn't pull away. Every scream from Emmy, every quiet nod from Aaron, every century Ezriel waited. Every second of it mattered.",
        },
        {
          text: "I'm going to miss them.",
          reaction:
            "They'll miss you too. Somewhere in a villa that doesn't quite exist, sixteen people from different worlds are better for having met each other. And better for having met you. Luke is still cooking breakfast. Ellie is still pretending she doesn't like it. Some things don't need to end.",
        },
        {
          text: "Play again?",
          reaction:
            "The villa never really closes. The fairy lights are always on. And somewhere, Nana is still sitting in a box, and Luke is still red, and Ellie is still pretending she doesn't care about a boy who makes her breakfast every morning.",
        },
      ],
    },
  ],
};
