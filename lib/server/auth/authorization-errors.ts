export class AuthenticationRequired extends Error {
  readonly code = "authentication_required";

  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationRequired";
  }
}

export class RoleForbidden extends Error {
  readonly code = "role_forbidden";

  constructor(message = "This account role cannot perform that operation.") {
    super(message);
    this.name = "RoleForbidden";
  }
}

export class ResourceForbidden extends Error {
  readonly code = "resource_forbidden";

  constructor(message = "You do not have access to that resource.") {
    super(message);
    this.name = "ResourceForbidden";
  }
}

export class ResourceNotFound extends Error {
  readonly code = "resource_not_found";

  constructor(message = "The requested resource was not found.") {
    super(message);
    this.name = "ResourceNotFound";
  }
}

export class Conflict extends Error {
  readonly code = "conflict";

  constructor(message = "The requested change conflicts with the current state.") {
    super(message);
    this.name = "Conflict";
  }
}
