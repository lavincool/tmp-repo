"use client";

import React from "react";
import type { RecognizedFaceDto } from "@/lib/contracts";

interface FaceOverlayProps {
  imageWidth: number;
  imageHeight: number;
  faces: RecognizedFaceDto[];
  selectedIndex: number | null;
  onSelectFace: (detectionIndex: number) => void;
}

export function FaceOverlay({
  imageWidth,
  imageHeight,
  faces,
  selectedIndex,
  onSelectFace,
}: FaceOverlayProps) {
  if (faces.length === 0 || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  // Base font size scaled with image dimensions for crisp readability
  const baseFontSize = Math.max(12, Math.round(imageWidth * 0.024));
  const strokeWidthSelected = Math.max(3, Math.round(imageWidth * 0.005));
  const strokeWidthNormal = Math.max(2, Math.round(imageWidth * 0.003));

  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ overflow: "visible" }}
      aria-label="Superposición de rostros detectados"
    >
      <defs>
        <filter id="box-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      {faces.map((face) => {
        const isSelected = selectedIndex === face.detectionIndex;

        const x = face.boundingBox.left * imageWidth;
        const y = face.boundingBox.top * imageHeight;
        const width = face.boundingBox.width * imageWidth;
        const height = face.boundingBox.height * imageHeight;

        let labelText = "Sin coincidencia";
        if (face.status === "matched") {
          labelText = face.name;
        } else if (face.status === "failed") {
          labelText = "No evaluado";
        }

        const strokeColor = isSelected ? "#0071E3" : "rgba(255, 255, 255, 0.95)";
        const badgeBg = isSelected ? "#0071E3" : "rgba(29, 29, 31, 0.85)";
        const badgeHeight = baseFontSize + 10;
        const badgeWidth = Math.max(70, labelText.length * (baseFontSize * 0.6) + 16);
        const badgeY = y > badgeHeight + 6 ? y - badgeHeight - 4 : y + 4;
        const badgeX = Math.min(Math.max(4, x), Math.max(4, imageWidth - badgeWidth - 4));

        return (
          <g
            key={`face-${face.detectionIndex}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectFace(face.detectionIndex);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectFace(face.detectionIndex);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Rostro ${face.detectionIndex + 1}: ${labelText}`}
            className="cursor-pointer focus:outline-none transition-all duration-150 group"
          >
            {/* Outer contrast outline for readability on light/dark images */}
            <rect
              x={x - 1}
              y={y - 1}
              width={width + 2}
              height={height + 2}
              fill="none"
              stroke="rgba(0, 0, 0, 0.4)"
              strokeWidth={isSelected ? strokeWidthSelected + 2 : strokeWidthNormal + 2}
              rx={6}
            />

            {/* Main bounding box */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill={isSelected ? "rgba(0, 113, 227, 0.15)" : "rgba(255, 255, 255, 0.04)"}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthSelected : strokeWidthNormal}
              rx={5}
              filter="url(#box-shadow)"
              className="transition-colors duration-150"
            />

            {/* Label badge */}
            <rect
              x={badgeX}
              y={badgeY}
              width={badgeWidth}
              height={badgeHeight}
              fill={badgeBg}
              rx={5}
              filter="url(#box-shadow)"
            />
            <text
              x={badgeX + badgeWidth / 2}
              y={badgeY + badgeHeight / 2 + baseFontSize * 0.35}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={baseFontSize}
              fontWeight={600}
              className="select-none pointer-events-none"
            >
              {labelText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
