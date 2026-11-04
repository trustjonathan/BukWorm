export const greetings = {
  any: [
    "Hey {name}, what's on your mind?",
    "Good to see you, {name}.",
    "Ask away, {name}.",
    "What are we figuring out today, {name}?",
    "Hi {name}. Got a question?",
    "Back again, {name}. Let's get into it.",
    "Take a pause, bring a question, {name}.",
    "Hey there, {name}. Ready when you are.",
    "What shall we work on, {name}?",
    "Welcome back, {name}.",
    "Got something tricky? Bring it here, {name}.",
    "Let's think it through together, {name}.",
    "Your move, {name}.",
    "Curious about something, {name}?",
    "Pull up a chair, {name}.",
    "Hey {name}, how can I help?",
    "Fresh page, {name}. What's first?",
    "Good to have you here, {name}.",
    "Let's make something happen, {name}.",
    "Anything on your mind, {name}?"
  ],
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
    "What are we learning today?",
    "Good morning, {name}. What's first on the list?",
    "Morning, {name}. Fresh start, fresh questions.",
    "Rise and think, {name}.",
    "Morning, {name}. Coffee and questions?",
    "A new day, {name}. What shall we tackle?"
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
    "Midday momentum looks good on you",
    "Good afternoon, {name}. How's the day going?",
    "Afternoon, {name}. What can I help with?",
    "Midday check-in, {name}. What's up?",
    "Hey {name}, still going strong?",
    "Afternoon, {name}. Let's keep it moving."
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
    "Your next idea can start whenever you’re ready",
    "Good evening, {name}. What's on your mind?",
    "Evening, {name}. Let's wrap something up.",
    "Hey {name}, winding down or gearing up?",
    "Evening, {name}. One more question?",
    "Quiet hour, {name}. Good time to think."
  ],
  lateNight: [
    "A warm welcome to the quiet hours, {name}",
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
    "The moon approves of asking questions",
    "Still up, {name}? Let's make it count.",
    "Late-night thinking, {name}?",
    "Burning the midnight oil, {name}?",
    "Hey {name}, don't forget to rest too.",
    "Night owl mode, {name}. What's up?"
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
          : "lateNight"
  const greetingPool = [...greetings.any, ...greetings[timeOfDay]]
  const greeting = greetingPool[Math.floor(random() * greetingPool.length)]
  const firstName = displayName?.trim().split(/\s+/)[0]

  return greeting.replace("{name}", firstName || "there")
}
