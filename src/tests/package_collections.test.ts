// PocketBun-only: verifies collection creation through the public package entrypoint.

import { describe, expect, it } from "bun:test";
import { Collection, newCollection, newBaseCollection, newAuthCollection, newViewCollection } from "../../index.ts";
import {
  TextField,
  NumberField,
  AutodateField,
  Record,
  bindCore,
  BoolField,
  URLField,
  EmailField,
  EditorField,
  PasswordField,
  DateField,
  JSONField,
  RelationField,
  SelectField,
  FileField,
  GeoPointField,
} from "../../index.ts";
import { newTestApp } from "./app.ts";

describe("package collection exports", () => {
  it("initializes every field constructor with typed lower-camel options", () => {
    const constructors = [
      TextField,
      NumberField,
      AutodateField,
      BoolField,
      URLField,
      EmailField,
      EditorField,
      PasswordField,
      DateField,
      JSONField,
      RelationField,
      SelectField,
      FileField,
      GeoPointField,
    ];
    for (const Ctor of constructors) {
      const field = new Ctor({ name: "test", hidden: true });
      expect(field.GetName()).toBe("test");
      expect(field.name).toBe("test");
      expect(field.GetHidden()).toBe(true);
      field.name = "renamed";
      expect(field.GetName()).toBe("renamed");
    }
    expect(new TextField({ Name: "upper", Max: 255 }).max).toBe(255);
    expect(new NumberField({ onlyInt: true }).OnlyInt).toBe(true);
    expect(new AutodateField({ onCreate: true, onUpdate: true }).OnUpdate).toBe(true);
    const target = { label: "retained" };
    const core = bindCore(target);
    expect(target).toBe(core);
    expect(core.label).toBe("retained");
    expect(core.TextField).toBe(TextField);
    expect(new core.TextField({ name: "bound", required: true }).Required).toBe(true);
  });

  it("persists new records constructed with imported and bound constructors", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const media = newBaseCollection("package_records");
      media.fields.add(
        new TextField({ name: "title", required: true, max: 255 }),
        new NumberField({ name: "year", onlyInt: true }),
        new AutodateField({ name: "created", onCreate: true }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      );
      expect(await app.save(media)).toBeNull();
      for (const Ctor of [Record, bindCore({}).Record]) {
        const record = new Ctor(media, { title: "Example" });
        expect(record.isNew()).toBe(true);
        record.set("year", 2026);
        expect(await app.save(record)).toBeNull();
        expect(record.isNew()).toBe(false);
        const saved = app.findRecordById(media, record.id);
        expect(saved.getString("title")).toBe("Example");
        expect(saved.getInt("year")).toBe(2026);
        expect(saved.getString("created")).not.toBe("");
        saved.set("title", "Updated");
        expect(await app.save(saved)).toBeNull();
        expect(app.findRecordById(media, saved.id).getString("title")).toBe("Updated");
      }
    } finally {
      await cleanup();
    }
  });

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
