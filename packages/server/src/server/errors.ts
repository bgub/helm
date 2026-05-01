import { Schema } from "effect";

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>()(
  "SessionNotFound",
  { id: Schema.String },
) {}

export class OperationNotFound extends Schema.TaggedError<OperationNotFound>()(
  "OperationNotFound",
  { qualifiedName: Schema.String },
) {}
