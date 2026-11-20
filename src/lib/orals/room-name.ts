/** "Isaac Newton Building (room to be confirmed)" reads as "Isaac Newton Building". */
export const cleanRoomName = (n: string) => n.replace(/\s*\([^)]*confirm[^)]*\)/i, "").trim();
