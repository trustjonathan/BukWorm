/** @jest-environment node */

import { getRandomGreeting, greetings } from "@/lib/greetings"

describe("getRandomGreeting", () => {
  it.each([
    [8, "morning"],
    [14, "afternoon"],
    [19, "evening"],
    [23, "night"],
    [2, "night"]
  ])("selects a %s-hour greeting for the %s", (hour, _timeOfDay) => {
    const greeting = getRandomGreeting(
      "Jonathan Example",
      new Date(2026, 10, 4, hour),
      () => 0
    )

    expect(greeting).toContain("Jonathan")
    expect(greeting).not.toContain("{name}")
  })

  it("uses a friendly fallback when the display name is missing", () => {
    expect(
      getRandomGreeting(null, new Date(2026, 10, 4, 8), () => 0)
    ).toContain("there")
  })

  it("offers different greetings within the same time period", () => {
    const morning = new Date(2026, 10, 4, 8)

    expect(getRandomGreeting("Jonathan", morning, () => 0)).not.toBe(
      getRandomGreeting("Jonathan", morning, () => 0.99)
    )
  })

  it("includes the requested late-night greetings in the random pool", () => {
    const lateNightPoolSize = greetings.any.length + greetings.lateNight.length
    const stillUpIndex =
      greetings.any.length +
      greetings.lateNight.indexOf("Still up, {name}? Let's make it count.")

    expect(
      getRandomGreeting(
        "Jonathan",
        new Date(2026, 10, 4, 23),
        () => (stillUpIndex + 0.1) / lateNightPoolSize
      )
    ).toBe("Still up, Jonathan? Let's make it count.")
  })
})
