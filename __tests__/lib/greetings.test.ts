/** @jest-environment node */

import { getRandomGreeting } from "@/lib/greetings"

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
    expect(greeting).not.toMatch(/still up/i)
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
})
