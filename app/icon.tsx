import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#eae5e0",
        border: "1px solid #c9c2b9",
        color: "#17140f",
        fontFamily: "Georgia, serif",
        fontSize: 20,
        fontStyle: "italic",
        fontWeight: 600,
        borderRadius: 7,
      }}
    >
      <span>Z</span>
      <span
        style={{
          position: "absolute",
          right: 5,
          bottom: 5,
          width: 4,
          height: 4,
          borderRadius: 999,
          background: "#c74d0c",
        }}
      />
    </div>,
    size,
  );
}
