import type { Comment, Lesson, OverlayStroke, Poem, Reply, Student, Workshop } from "../types";

const WORKSHOP_NAME = 'What the "I" Doesn\'t See: Beyond the First-Person Lyric';

// Placeholder, like the lorem-ipsum poem bodies below — real location/time
// details weren't available when this prototype was seeded. Swap in the
// actual workshop logistics when available; nothing else needs to change.
export const workshop: Workshop = {
  name: WORKSHOP_NAME,
  instructor: "Sam Cha",
  totalClasses: 6,
  location: "Location TBD",
  meetingTime: "Meeting time TBD",
};

export const students: Student[] = [
  {
    id: "dickinson",
    name: "Emily Dickinson",
    initials: "ED",
    bio: "Writes in near-total isolation and edits relentlessly. New to Sam's workshop this term.",
    workshops: [`${WORKSHOP_NAME} — Spring 2026`],
  },
  {
    id: "lorde",
    name: "Audre Lorde",
    initials: "AL",
    bio: "Poet and essayist working at the intersection of the political and the personal. Returning student.",
    workshops: [
      `${WORKSHOP_NAME} — Spring 2026`,
      "The Poem as Testimony — Fall 2025",
    ],
  },
  {
    id: "hughes",
    name: "Langston Hughes",
    initials: "LH",
    bio: "Writes toward music — blues, jazz, the rhythms of Harlem. Third workshop with Sam.",
    workshops: [
      `${WORKSHOP_NAME} — Spring 2026`,
      "Poetry & Place — Winter 2026",
      "The Poem as Testimony — Fall 2025",
    ],
  },
  {
    id: "seuss",
    name: "Diane Seuss",
    initials: "DS",
    bio: "Formally restless — sonnets, prose poems, whatever the line demands. New this term.",
    workshops: [`${WORKSHOP_NAME} — Spring 2026`],
  },
  {
    id: "crane",
    name: "Hart Crane",
    initials: "HC",
    bio: "Drawn to the long line and the big American myth. Second workshop with Sam.",
    workshops: [
      `${WORKSHOP_NAME} — Spring 2026`,
      "Poetry & Place — Winter 2026",
    ],
  },
];

// Dickinson is public domain and this is the standard, widely-anthologized
// text, so it's reproduced in full. The other four poems are still under
// copyright (or, for Crane, not text this app's author could reproduce
// word-for-word with confidence) — those bodies are lorem ipsum placeholders
// standing in for the real poem until real, rights-cleared text is dropped in.
const dickinsonBody = `Because I could not stop for Death –
He kindly stopped for me –
The Carriage held but just Ourselves –
And Immortality.

We slowly drove – He knew no haste
And I had put away
My labor and my leisure too,
For His Civility –

We passed the School, where Children strove
At Recess – in the Ring –
We passed the Fields of Gazing Grain –
We passed the Setting Sun –

Or rather – He passed us –
The Dews drew quivering and Chill –
For only Gossamer, my Gown –
My Tippet – only Tulle –

We paused before a House that seemed
A Swelling of the Ground –
The Roof was scarcely visible –
The Cornice – in the Ground –

Since then – 'tis Centuries – and yet
Feels shorter than the Day
I first surmised the Horses' Heads
Were toward Eternity –`;

const craneBody = `Lorem ipsum dolor sit amet, consectetur
adipiscing elit, sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua,
scattered like wreckage without sound of bells.

Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi
ut aliquip ex ea commodo consequat,
a calyx of dusty shore and embassy.

Duis aute irure dolor in reprehenderit
in voluptate velit esse cillum dolore,
frosted eyes there were that lifted altars
in circuit calm of one vast coil.

Excepteur sint occaecat cupidatat non proident,
sunt in culpa qui officia deserunt,
compass, quadrant and sextant contrive
no farther tides than this fabulous shadow.`;

const lordeBody = `Sed ut perspiciatis unde omnis iste natus
error sit voluptatem accusantium doloremque
laudantium, totam rem aperiam eaque ipsa
quae ab illo inventore veritatis.

Neque porro quisquam est, qui dolorem ipsum
quia dolor sit amet, consectetur, adipisci velit,
sed quia non numquam eius modi tempora
incidunt ut labore et dolore magnam aliquam.

Ut enim ad minima veniam, quis nostrum
exercitationem ullam corporis suscipit laboriosam,
nisi ut aliquid ex ea commodi consequatur,
quis autem vel eum iure reprehenderit.

Quae ab illo inventore veritatis et quasi
architecto beatae vitae dicta sunt explicabo,
for we were never meant to survive,
nemo enim ipsam voluptatem quia voluptas sit.`;

const hughesBody = `At vero eos et accusamus et iusto odio
dignissimos ducimus qui blanditiis praesentium
voluptatum deleniti atque corrupti quos dolores
et quas molestias excepturi sint occaecati.

Cupiditate non provident, similique sunt in culpa
qui officia deserunt mollitia animi, id est laborum
et dolorum fuga, does it dry up
like a raisin in the sun, et harum quidem.

Rerum facilis est et expedita distinctio,
nam libero tempore, cum soluta nobis
est eligendi optio cumque nihil impedit
quo minus id quod maxime placeat facere.`;

const seussBody = `Temporibus autem quibusdam et aut officiis
debitis aut rerum necessitatibus saepe eveniet,
ut et voluptates repudiandae sint et molestiae
non recusandae, itaque earum rerum hic tenetur.

A sapiente delectus, ut aut reiciendis voluptatibus
maiores alias consequatur aut perferendis doloribus
asperiores repellat, four-legged and stitched
from someone else's rib, quibusdam officiis debitis.

Aut rerum necessitatibus saepe eveniet ut et
voluptates repudiandae sint et molestiae non
recusandae, itaque earum rerum hic tenetur
a sapiente delectus ut aut reiciendis.`;

export const poems: Poem[] = [
  {
    id: "because-i-could-not-stop-for-death",
    title: "Because I could not stop for Death –",
    studentId: "dickinson",
    status: "feedback_given",
    classNumber: 1,
    body: dickinsonBody,
  },
  {
    id: "at-melvilles-tomb",
    title: "At Melville's Tomb",
    studentId: "crane",
    status: "awaiting_feedback",
    classNumber: 1,
    body: craneBody,
  },
  {
    id: "a-litany-for-survival",
    title: "A Litany for Survival",
    studentId: "lorde",
    status: "awaiting_feedback",
    classNumber: 1,
    body: lordeBody,
  },
  {
    id: "harlem",
    title: "Harlem",
    studentId: "hughes",
    status: "awaiting_feedback",
    classNumber: 1,
    body: hughesBody,
  },
  {
    id: "four-legged-girl",
    title: "Four-Legged Girl",
    studentId: "seuss",
    status: "feedback_given",
    classNumber: 1,
    body: seussBody,
  },
];

// Simulated peer feedback: each of Emily's four classmates (plus Sam, as
// instructor) has read and commented on "Because I could not stop for
// Death –", including two reply exchanges between classmates, to show what
// a real workshop thread on this page would look like. Offsets are computed
// from the actual quoted excerpt rather than hardcoded, so they can't drift
// out of sync with dickinsonBody above.
const DICKINSON_POEM_ID = "because-i-could-not-stop-for-death";

function findRange(body: string, excerpt: string): { start: number; end: number } {
  const start = body.indexOf(excerpt);
  if (start === -1) {
    throw new Error(`Seed comment excerpt not found in poem body: "${excerpt}"`);
  }
  return { start, end: start + excerpt.length };
}

const lordeCivilityExcerpt = "For His Civility –";
const hughesAnaphoraExcerpt =
  "We passed the School, where Children strove\nAt Recess – in the Ring –\nWe passed the Fields of Gazing Grain –\nWe passed the Setting Sun –";
const seussCorniceExcerpt = "The Roof was scarcely visible –\nThe Cornice – in the Ground –";
const craneEternityExcerpt = "Were toward Eternity –";
const instructorPassedUsExcerpt = "Or rather – He passed us –";

export const comments: Comment[] = [
  {
    id: "dickinson-comment-lorde-civility",
    poemId: DICKINSON_POEM_ID,
    authorId: "lorde",
    ...findRange(dickinsonBody, lordeCivilityExcerpt),
    excerpt: lordeCivilityExcerpt,
    text: "That word — Civility — is doing so much work. It's chilling how politeness becomes the register for a threat. Manners can be their own kind of violence when they're this composed.",
    createdAt: "2026-07-14T15:02:00.000Z",
  },
  {
    id: "dickinson-comment-hughes-anaphora",
    poemId: DICKINSON_POEM_ID,
    authorId: "hughes",
    ...findRange(dickinsonBody, hughesAnaphoraExcerpt),
    excerpt: hughesAnaphoraExcerpt,
    text: "That anaphora is doing the real driving here — ‘We passed... We passed... We passed...’ — it's the carriage's rhythm, unhurried but relentless. Feels like a blues turnaround. Study how she varies the line length underneath the repetition so it never goes stale.",
    createdAt: "2026-07-14T16:20:00.000Z",
  },
  {
    id: "dickinson-comment-seuss-cornice",
    poemId: DICKINSON_POEM_ID,
    authorId: "seuss",
    ...findRange(dickinsonBody, seussCorniceExcerpt),
    excerpt: seussCorniceExcerpt,
    text: "The grave rendered as a house with a sunken roofline — this is doing exactly what I'm always chasing: make the abstract (death) architectural, load-bearing. ‘Cornice’ is such a precise, unsentimental word for a headstone.",
    createdAt: "2026-07-15T09:41:00.000Z",
  },
  {
    id: "dickinson-comment-crane-eternity",
    poemId: DICKINSON_POEM_ID,
    authorId: "crane",
    ...findRange(dickinsonBody, craneEternityExcerpt),
    excerpt: craneEternityExcerpt,
    text: "The horses' heads pointed at Eternity — that's the whole poem's cosmology in five words. It's doing what I want my own long lines to do: let the image carry the metaphysics instead of stating it.",
    createdAt: "2026-07-15T11:10:00.000Z",
  },
  {
    id: "dickinson-comment-instructor-passed-us",
    poemId: DICKINSON_POEM_ID,
    authorId: "scha",
    ...findRange(dickinsonBody, instructorPassedUsExcerpt),
    excerpt: instructorPassedUsExcerpt,
    text: "This is the pivot the whole workshop keeps circling — the ‘I’ realizes it's the one standing still. Death didn't just come for her, he overtook her while she thought she was still moving. Where else does this speaker's certainty about her own position quietly get corrected?",
    createdAt: "2026-07-16T10:00:00.000Z",
  },
];

export const replies: Reply[] = [
  {
    id: "dickinson-reply-crane-on-lorde",
    poemId: DICKINSON_POEM_ID,
    parentId: "dickinson-comment-lorde-civility",
    authorId: "crane",
    text: "Agreed — and it primes the ear for ‘quivering and Chill’ two stanzas later. The civility is a held breath before the poem lets the cold in.",
    createdAt: "2026-07-14T18:33:00.000Z",
  },
  {
    id: "dickinson-reply-seuss-on-hughes",
    poemId: DICKINSON_POEM_ID,
    parentId: "dickinson-comment-hughes-anaphora",
    authorId: "seuss",
    text: "Agreed on the anaphora, but don't miss how the dashes keep breaking the meter's back — every ‘We passed’ gets a full stop right after. The rhythm wants to run and the punctuation keeps yanking the reins. That tension is the poem.",
    createdAt: "2026-07-14T20:05:00.000Z",
  },
];

// Each of the four classmates also marked up the poem directly
// (stylus/freehand), each with a note attached — same "peer feedback" idea
// as the comments above, but for the Markup side. Positions are fractions
// (0..1) of the poem-body box, hand-estimated against the rendered layout
// and then verified/adjusted against real screenshots (see project history)
// rather than computed exactly — there's no text-offset equivalent for
// freehand coordinates the way `findRange` gives comments.
export const overlayStrokes: OverlayStroke[] = [
  {
    id: "dickinson-stroke-hughes-slowly-drove",
    poemId: DICKINSON_POEM_ID,
    authorId: "hughes",
    points: [
      { x: 0.045, y: 0.209 },
      { x: 0.12, y: 0.217 },
      { x: 0.2, y: 0.207 },
      { x: 0.28, y: 0.216 },
      { x: 0.35, y: 0.208 },
    ],
    comment: "Even here the syntax refuses to rush — 'slowly' gets to land before the dash breaks the line.",
    createdAt: "2026-07-14T17:05:00.000Z",
  },
  {
    id: "dickinson-stroke-seuss-tippet-tulle",
    poemId: DICKINSON_POEM_ID,
    authorId: "seuss",
    points: [
      { x: 0.045, y: 0.637 },
      { x: 0.15, y: 0.644 },
      { x: 0.26, y: 0.634 },
      { x: 0.37, y: 0.643 },
      { x: 0.47, y: 0.636 },
    ],
    comment: "This tiny, almost comic inventory item right before the poem goes cosmic — that's very much a move I'd make.",
    createdAt: "2026-07-15T09:55:00.000Z",
  },
  // The other two classmates' marks: circle a word, draw a connecting line,
  // circle a second word elsewhere in the poem, one comment on the whole
  // gesture — a single continuous stroke (circle → line → circle) with one
  // `comment`, since there's no multi-stroke grouping mechanism to attach
  // one note to several separate marks.
  {
    id: "dickinson-stroke-lorde-death-immortality",
    poemId: DICKINSON_POEM_ID,
    authorId: "lorde",
    points: [
      { x: 0.5364, y: 0.0385 },
      { x: 0.5331, y: 0.0505 },
      { x: 0.516, y: 0.0593 },
      { x: 0.4913, y: 0.0619 },
      { x: 0.468, y: 0.0573 },
      { x: 0.4544, y: 0.0472 },
      { x: 0.4555, y: 0.0352 },
      { x: 0.4709, y: 0.0256 },
      { x: 0.495, y: 0.022 },
      { x: 0.5191, y: 0.0256 },
      { x: 0.5345, y: 0.0352 },
      { x: 0.2746, y: 0.136 },
      { x: 0.2676, y: 0.148 },
      { x: 0.231, y: 0.1568 },
      { x: 0.1782, y: 0.1594 },
      { x: 0.1281, y: 0.1548 },
      { x: 0.0991, y: 0.1447 },
      { x: 0.1014, y: 0.1327 },
      { x: 0.1344, y: 0.1231 },
      { x: 0.186, y: 0.1195 },
      { x: 0.2376, y: 0.1231 },
      { x: 0.2706, y: 0.1327 },
    ],
    comment: "Death and Immortality, yoked in the very first breath of the poem — no space between them for doubt to get in.",
    createdAt: "2026-07-14T15:20:00.000Z",
  },
  {
    id: "dickinson-stroke-crane-carriage-gossamer",
    poemId: DICKINSON_POEM_ID,
    authorId: "crane",
    points: [
      { x: 0.227, y: 0.1033 },
      { x: 0.2219, y: 0.1153 },
      { x: 0.1955, y: 0.1241 },
      { x: 0.1573, y: 0.1267 },
      { x: 0.1212, y: 0.1221 },
      { x: 0.1002, y: 0.112 },
      { x: 0.1019, y: 0.1 },
      { x: 0.1257, y: 0.0904 },
      { x: 0.163, y: 0.0868 },
      { x: 0.2003, y: 0.0904 },
      { x: 0.2241, y: 0.1 },
      { x: 0.303, y: 0.5948 },
      { x: 0.2979, y: 0.6068 },
      { x: 0.2715, y: 0.6156 },
      { x: 0.2333, y: 0.6182 },
      { x: 0.1972, y: 0.6136 },
      { x: 0.1762, y: 0.6035 },
      { x: 0.1779, y: 0.5915 },
      { x: 0.2017, y: 0.5819 },
      { x: 0.239, y: 0.5783 },
      { x: 0.2763, y: 0.5819 },
      { x: 0.3001, y: 0.5915 },
    ],
    comment: "'Carriage' and 'Gossamer' — two strange, textured nouns doing more work than any adjective could. That's the whole poem's material strangeness in two words.",
    createdAt: "2026-07-15T13:40:00.000Z",
  },
];

// Only Class 1 has a lesson filled in — the rest are unwritten, same as how
// classNumbersWithPoems on the home page tolerates classes with nothing
// submitted yet. Content here is original prototype filler in the
// instructor's voice, not transcribed from any real Brooklyn Poets lesson.
export const lessons: Lesson[] = [
  {
    id: "lesson-class-1",
    classNumber: 1,
    segments: [
      {
        id: "lesson-class-1-welcome",
        heading: "Welcome & housekeeping",
        html: "<p>Good to have everyone here. A few logistics before we start: office hours are by request this term — just email me. Submit each week's poem by Sunday night so everyone has time to read before we meet.</p>",
      },
      {
        id: "lesson-class-1-framing",
        heading: "What the \"I\" doesn't see",
        html: "<p>The title question for this workshop: what does a first-person speaker <em>fail</em> to notice about itself, and how does a poem let that blind spot show without stating it outright?</p><p>Keep this in mind as you read the poems on the syllabus — not \"what does the speaker say,\" but \"what does the speaker's saying accidentally reveal.\"</p>",
      },
      {
        id: "lesson-class-1-exercise",
        heading: "In-class exercise",
        html: "<p>Write a short first-person passage from a speaker who is confident, even boastful, about something the reader can tell they're wrong about. Don't editorialize — let the gap do the work.</p>",
      },
    ],
  },
];
