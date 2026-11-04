const GREETINGS = {
  morning: [
    "Good morning, {name}",
    "Morning, {name}!",
    "A bright morning to you, {name}",
    "Welcome to a fresh morning, {name}",
    "Ready for a new day, {name}?",
    "Hope your morning is off to a lovely start, {name}",
    "A new day, a fresh page, {name}",
    "Sending a little morning sunshine your way, {name}",
    "What shall we explore this morning, {name}?",
    "Your morning ideas are welcome here, {name}",
    "Rise into something wonderful, {name}",
    "Good morning! What’s on your mind, {name}?",
    "A calm start or a bold idea, {name}?",
    "The day is full of possibilities, {name}",
    "Hello, morning thinker!",
    "Good morning, curious mind",
    "A fresh cup of possibility, anyone?",
    "Morning light, open mind",
    "Here’s to a thoughtful start",
    "What are we learning today?"
  ],
  afternoon: [
    "Good afternoon, {name}",
    "Afternoon, {name}!",
    "A bright afternoon to you, {name}",
    "Welcome to your afternoon thinking space, {name}",
    "What’s the afternoon bringing, {name}?",
    "Hope your day is unfolding nicely, {name}",
    "A good moment for a new idea, {name}",
    "Let’s make this afternoon count, {name}",
    "Your next great thought could start here, {name}",
    "A little afternoon inspiration, {name}?",
    "Good afternoon! What can we untangle, {name}?",
    "Take a pause, bring a question, {name}",
    "The afternoon is yours to shape, {name}",
    "Ready for a curious detour, {name}?",
    "Hello, afternoon explorer",
    "A bright idea for the middle of the day?",
    "Your afternoon brainstorm starts here",
    "A moment to think, make, or discover",
    "What are we figuring out this afternoon?",
    "Midday momentum looks good on you"
  ],
  evening: [
    "Good evening, {name}",
    "Evening, {name}!",
    "A peaceful evening to you, {name}",
    "Welcome to a gentler part of the day, {name}",
    "What’s on your mind this evening, {name}?",
    "Let’s give that idea an evening to shine, {name}",
    "A little space to think, {name}",
    "Unwind, wonder, and ask away, {name}",
    "The evening is open for good questions, {name}",
    "Hope your evening is treating you kindly, {name}",
    "A thoughtful end to the day starts here, {name}",
    "Ready to explore one more idea, {name}?",
    "Good evening! Where shall we begin, {name}?",
    "Settle in; curiosity is welcome, {name}",
    "Hello, evening thinker",
    "A quiet moment for a bright idea",
    "Let’s close the day with a good question",
    "Evening calm, curious mind",
    "What would make tonight interesting?",
    "Your next idea can start whenever you’re ready"
  ],
  night: [
    "Good night-time thinking, {name}",
    "Hello, night owl {name}",
    "A little moonlit curiosity, {name}?",
    "Welcome to the after-hours idea lounge, {name}",
    "The stars are out; what are you wondering, {name}?",
    "A quiet night is perfect for big questions, {name}",
    "Let’s follow that late-night thought, {name}",
    "Night mode: curiosity on, {name}",
    "A peaceful night and an open mind, {name}",
    "What’s keeping your imagination company, {name}?",
    "Good evening, stargazer {name}",
    "The night has room for one more idea, {name}",
    "A midnight spark of inspiration, {name}?",
    "Your nocturnal brainstorming nook is ready, {name}",
    "Hello, midnight thinker",
    "A little night-sky inspiration?",
    "Quiet hours, curious thoughts",
    "What would you like to discover tonight?",
    "A soft landing for a big question",
    "The moon approves of asking questions"
  ]
} as const

export function getRandomGreeting(
  displayName?: string | null,
  date = new Date(),
  random = Math.random
) {
  const hour = date.getHours()
  const timeOfDay =
    hour >= 5 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 17
        ? "afternoon"
        : hour >= 17 && hour < 22
          ? "evening"
          : "night"
  const greetings = GREETINGS[timeOfDay]
  const greeting = greetings[Math.floor(random() * greetings.length)]
  const firstName = displayName?.trim().split(/\s+/)[0]

  return greeting.replace("{name}", firstName || "there")
}
