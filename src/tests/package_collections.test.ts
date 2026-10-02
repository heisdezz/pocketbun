// PocketBun-only: verifies collection creation through the public package entrypoint.

import { describe, expect, it } from "bun:test";
import { Collection, newCollection, newBaseCollection, newAuthCollection, newViewCollection } from "../../index.ts";
import { newTestApp } from "./app.ts";

describe("package collection exports", () => {
  it("initializes collection factory defaults and optional ids", () => {
    for (const [type, factory] of [
      ["base", newBaseCollection],
      ["auth", newAuthCollection],
      ["view", newViewCollection],
    ] as const) {
      const collection = factory("exported", "exported_id");
      expect(collection).toBeInstanceOf(Collection);
      expect(collection.type).toBe(type);
      expect(collection.id).toBe("exported_id");
      expect(collection.isNew()).toBe(true);
      if (type !== "view") {
        expect(collection.fields.GetByName("id")).not.toBeNull();
      }
      expect(newCollection(type, "selected").type).toBe(type);
    }
    expect(newAuthCollection("members").fields.GetByName("email")).not.toBeNull();
    expect(newAuthCollection("members").PasswordAuth.Enabled).toBe(true);
  });

  it("persists, updates, and deletes collection metadata and SQLite tables", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collections = [newBaseCollection("exported_media"), new Collection({ name: "constructed_media", type: "base" })];
      for (const collection of collections) {
        collection.fields.addMarshaledJSON(JSON.stringify([{ name: "title", type: "text", required: true }]));
        expect(await app.save(collection)).toBeNull();
        const saved = app.findCollectionByNameOrId(collection.name);
        expect(saved.id).toBe(collection.id);
        expect(saved.fields.GetByName("title")?.GetName()).toBe("title");
        expect(app.tableColumns(saved.name)).toContain("title");

        saved.fields.addMarshaledJSON(JSON.stringify([{ name: "year", type: "number" }]));
        expect(await app.save(saved)).toBeNull();
        expect(app.tableColumns(saved.name)).toContain("year");

        expect(await app.delete(saved)).toBeNull();
        expect(app.hasTable(saved.name)).toBe(false);
        expect(() => app.findCollectionByNameOrId(saved.id)).toThrow();
      }
    } finally {
      await cleanup();
    }
  });
});
