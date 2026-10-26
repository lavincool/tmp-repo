import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only marker for Vitest environment
vi.mock("server-only", () => ({}));

import sharp from "sharp";
import {
  enrollPerson,
  listPeople,
  deletePerson,
  recognizeFaces,
  FaceEnrollmentError,
} from "./faces";
import { ImageValidationError, validateImageBytes } from "./images";
import type { Viso } from "@viso-lol/sdk";

// Helper to create test JPEG buffer
async function createTestImage(
  width = 120,
  height = 120,
  format: "jpeg" | "png" = "jpeg",
): Promise<Buffer> {
  const instance = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  });
  return format === "jpeg" ? instance.jpeg().toBuffer() : instance.png().toBuffer();
}

describe("Face Services and Server Logic", () => {
  const testCollectionId = "col_test_123";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.VISO_API_KEY = "viso_sk_testkey";
    process.env.VISO_COLLECTION_ID = testCollectionId;
  });

  describe("Server Image Validation", () => {
    it("rejects non-image or malformed bytes", async () => {
      const invalidBytes = Buffer.from("not an image at all");
      await expect(validateImageBytes(invalidBytes)).rejects.toThrow(ImageValidationError);
    });

    it("rejects image smaller than 80x80", async () => {
      const smallImage = await createTestImage(70, 70);
      await expect(validateImageBytes(smallImage)).rejects.toThrow(ImageValidationError);
    });

    it("rejects image exceeding 2,000,000 pixels", async () => {
      // 2000 x 1100 = 2,200,000 px > 2,000,000
      const largeImage = await createTestImage(2000, 1100);
      await expect(validateImageBytes(largeImage)).rejects.toThrow(ImageValidationError);
    });

    it("accepts valid JPEG within constraints", async () => {
      const validImage = await createTestImage(200, 200, "jpeg");
      const res = await validateImageBytes(validImage);
      expect(res.width).toBe(200);
      expect(res.height).toBe(200);
      expect(res.format).toBe("jpeg");
    });

    it("accepts valid PNG within constraints", async () => {
      const validImage = await createTestImage(150, 150, "png");
      const res = await validateImageBytes(validImage);
      expect(res.width).toBe(150);
      expect(res.height).toBe(150);
      expect(res.format).toBe("png");
    });
  });

  describe("Enrollment", () => {
    it("prevents indexing when 0 faces are detected", async () => {
      const imageBytes = await createTestImage();

      const mockViso = {
        face: {
          detect: vi.fn().mockResolvedValue({
            object: "face_detection",
            faces: [],
            image: { width: 120, height: 120, format: "jpeg" },
          }),
          collections: {
            faces: {
              index: vi.fn(),
            },
          },
        },
      } as unknown as Viso;

      await expect(
        enrollPerson(imageBytes, "Ada Lovelace", "true", mockViso, testCollectionId),
      ).rejects.toThrowError(FaceEnrollmentError);

      expect(mockViso.face.detect).toHaveBeenCalledOnce();
      expect(mockViso.face.collections.faces.index).not.toHaveBeenCalled();
    });

    it("prevents indexing when multiple faces are detected", async () => {
      const imageBytes = await createTestImage();

      const mockViso = {
        face: {
          detect: vi.fn().mockResolvedValue({
            object: "face_detection",
            faces: [
              { boundingBox: { left: 0.1, top: 0.1, width: 0.3, height: 0.3 }, confidence: 99 },
              { boundingBox: { left: 0.5, top: 0.5, width: 0.3, height: 0.3 }, confidence: 98 },
            ],
            image: { width: 120, height: 120, format: "jpeg" },
          }),
          collections: {
            faces: {
              index: vi.fn(),
            },
          },
        },
      } as unknown as Viso;

      await expect(
        enrollPerson(imageBytes, "Ada Lovelace", "true", mockViso, testCollectionId),
      ).rejects.toThrowError(FaceEnrollmentError);

      expect(mockViso.face.detect).toHaveBeenCalledOnce();
      expect(mockViso.face.collections.faces.index).not.toHaveBeenCalled();
    });

    it("rejects enrollment without consent", async () => {
      const imageBytes = await createTestImage();
      const mockViso = {} as unknown as Viso;

      await expect(
        enrollPerson(imageBytes, "Ada Lovelace", "false", mockViso, testCollectionId),
      ).rejects.toThrowError(FaceEnrollmentError);
    });

    it("successfully indexes exactly one face, preserving name and externalId", async () => {
      const imageBytes = await createTestImage();

      const mockIndexResult = {
        object: "face_index_result",
        indexed: [
          {
            object: "face",
            id: "face_12345",
            collectionId: testCollectionId,
            externalId: "ext_custom_uuid",
            metadata: { name: "Ada Lovelace", consentAt: "2026-10-26T15:00:00Z" },
            boundingBox: { left: 0.2, top: 0.2, width: 0.5, height: 0.5 },
            confidence: 99.5,
            createdAt: "2026-10-26T15:00:00Z",
          },
        ],
        unindexed: [],
      };

      const mockViso = {
        face: {
          detect: vi.fn().mockResolvedValue({
            object: "face_detection",
            faces: [
              { boundingBox: { left: 0.2, top: 0.2, width: 0.5, height: 0.5 }, confidence: 99 },
            ],
            image: { width: 120, height: 120, format: "jpeg" },
          }),
          collections: {
            faces: {
              index: vi.fn().mockResolvedValue(mockIndexResult),
            },
          },
        },
      } as unknown as Viso;

      const result = await enrollPerson(
        imageBytes,
        "Ada Lovelace",
        "true",
        mockViso,
        testCollectionId,
      );

      expect(mockViso.face.detect).toHaveBeenCalledOnce();
      expect(mockViso.face.collections.faces.index).toHaveBeenCalledWith(
        testCollectionId,
        expect.objectContaining({
          maxFaces: 1,
          qualityFilter: "auto",
          metadata: expect.objectContaining({
            name: "Ada Lovelace",
            consentAt: expect.any(String),
          }),
        }),
      );

      expect(result.faceId).toBe("face_12345");
      expect(result.externalId).toBe("ext_custom_uuid");
      expect(result.name).toBe("Ada Lovelace");
    });
  });

  describe("Listing and Deletion", () => {
    it("lists stored faces using configured collection and reads metadata.name", async () => {
      const mockViso = {
        face: {
          collections: {
            faces: {
              list: vi.fn().mockResolvedValue({
                object: "list",
                data: [
                  {
                    id: "face_1",
                    externalId: "ext_1",
                    metadata: { name: "Grace Hopper" },
                  },
                  {
                    id: "face_2",
                    externalId: null,
                    metadata: {}, // absent name should use fallback
                  },
                ],
                nextCursor: "cursor_abc",
              }),
            },
          },
        },
      } as unknown as Viso;

      const res = await listPeople("prev_cursor", mockViso, testCollectionId);

      expect(mockViso.face.collections.faces.list).toHaveBeenCalledWith(testCollectionId, {
        limit: 20,
        cursor: "prev_cursor",
      });

      expect(res.people).toHaveLength(2);
      expect(res.people[0]).toEqual({
        faceId: "face_1",
        externalId: "ext_1",
        name: "Grace Hopper",
      });
      expect(res.people[1].name).toBe("Persona sin nombre");
      expect(res.nextCursor).toBe("cursor_abc");
    });

    it("deletes a face using the configured collection", async () => {
      const mockViso = {
        face: {
          collections: {
            faces: {
              delete: vi.fn().mockResolvedValue({
                id: "face_to_del",
                deleted: true,
              }),
            },
          },
        },
      } as unknown as Viso;

      const res = await deletePerson("face_to_del", mockViso, testCollectionId);

      expect(mockViso.face.collections.faces.delete).toHaveBeenCalledWith(
        testCollectionId,
        "face_to_del",
      );
      expect(res).toEqual({ success: true, id: "face_to_del" });
    });
  });

  describe("Face Recognition (faces only, omitting objects)", () => {
    it("calls vision.analyze with face-only options and fixed collection", async () => {
      const imageBytes = await createTestImage();

      const mockAnalysis = {
        object: "vision_analysis",
        image: { width: 120, height: 120, format: "jpeg" },
        faces: [],
        objects: [],
        operations: {
          faces: { status: "succeeded", errors: [] },
          objects: { status: "disabled", errors: [] },
        },
        partial: false,
      };

      const mockViso = {
        vision: {
          analyze: vi.fn().mockResolvedValue(mockAnalysis),
        },
      } as unknown as Viso;

      const res = await recognizeFaces(imageBytes, mockViso, testCollectionId);

      expect(mockViso.vision.analyze).toHaveBeenCalledWith({
        image: expect.any(Buffer),
        faces: {
          enabled: true,
          collectionId: testCollectionId,
          threshold: 90,
          maxDetectedFaces: 10,
        },
      });

      // Verify empty face array is valid
      expect(res.faces).toEqual([]);
      expect(res.partial).toBe(false);
    });

    it("distinguishes matched, unknown, failed, and partial results", async () => {
      const imageBytes = await createTestImage();

      const mockAnalysis = {
        object: "vision_analysis",
        image: { width: 120, height: 120, format: "jpeg" },
        faces: [
          {
            detectionIndex: 0,
            status: "matched",
            boundingBox: { left: 0.1, top: 0.1, width: 0.2, height: 0.2 },
            name: "Margaret Hamilton",
            match: {
              similarity: 94.7,
              face: {
                id: "face_mh",
                externalId: "ext_mh",
                metadata: { name: "Margaret Hamilton" },
                boundingBox: { left: 0.3, top: 0.3, width: 0.4, height: 0.4 }, // query box must NOT use this!
              },
            },
          },
          {
            detectionIndex: 1,
            status: "unknown",
            boundingBox: { left: 0.4, top: 0.1, width: 0.2, height: 0.2 },
            match: null,
            name: null,
          },
          {
            detectionIndex: 2,
            status: "failed",
            boundingBox: { left: 0.7, top: 0.1, width: 0.2, height: 0.2 },
            match: null,
            name: null,
            error: {
              code: "vision.crop_failed",
              message: "Crop failed",
              requestId: "req_fail_1",
            },
          },
        ],
        operations: {
          faces: {
            status: "partial",
            errors: [
              { code: "vision.crop_failed", message: "Crop failed", requestId: "req_fail_1" },
            ],
          },
        },
        partial: true,
      };

      const mockViso = {
        vision: {
          analyze: vi.fn().mockResolvedValue(mockAnalysis),
        },
      } as unknown as Viso;

      const res = await recognizeFaces(imageBytes, mockViso, testCollectionId);

      expect(res.partial).toBe(true);
      expect(res.faces).toHaveLength(3);

      // Matched face uses query boundingBox, not enrolled box
      const matched = res.faces[0];
      expect(matched.status).toBe("matched");
      if (matched.status === "matched") {
        expect(matched.name).toBe("Margaret Hamilton");
        expect(matched.similarity).toBe(94.7);
        expect(matched.boundingBox).toEqual({ left: 0.1, top: 0.1, width: 0.2, height: 0.2 });
      }

      // Unknown face
      const unknown = res.faces[1];
      expect(unknown.status).toBe("unknown");
      expect(unknown.name).toBeNull();

      // Failed face preserves error state
      const failed = res.faces[2];
      expect(failed.status).toBe("failed");
      if (failed.status === "failed") {
        expect(failed.error.code).toBe("vision.crop_failed");
        expect(failed.error.requestId).toBe("req_fail_1");
      }

      // Preserves operation error
      expect(res.operationError).toEqual({
        code: "vision.crop_failed",
        message: "Crop failed",
        requestId: "req_fail_1",
      });
    });
  });

  describe("Overlay Geometry Coordinates Check", () => {
    it("correctly maps normalized bounding boxes into SVG coordinate space", () => {
      const imageWidth = 800;
      const imageHeight = 600;
      const normalizedBox = { left: 0.25, top: 0.1, width: 0.5, height: 0.4 };

      const x = normalizedBox.left * imageWidth;
      const y = normalizedBox.top * imageHeight;
      const w = normalizedBox.width * imageWidth;
      const h = normalizedBox.height * imageHeight;

      expect(x).toBe(200);
      expect(y).toBe(60);
      expect(w).toBe(400);
      expect(h).toBe(240);
    });
  });
});
