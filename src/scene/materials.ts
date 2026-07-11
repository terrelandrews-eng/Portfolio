// Shared gray-box color palette for the 3D scene. Grows as later
// milestones (M4 materials pass, M5 lighting) replace flat colors with
// real textures/PBR — keep this the single place scene color decisions
// live so that swap is localized.

export const PALETTE = {
  floor: '#5a4632', // wood-brown flat floor
  wall: '#22333b', // desaturated teal-gray walls
  wallDark: '#152026', // ceiling / recessed wall segments
  desk: '#3e2a1c', // desk wood, darker than floor
  sky: '#2c5f6f', // dusk-sky gradient stand-in seen through the window
  marker: '#E8B54A', // amber exhibit marker (matches theme.colors.amber)
} as const;
