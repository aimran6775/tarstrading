import Foundation

/// Template for Config/Secrets.swift (which is gitignored and excluded from
/// the target if named .example). Copy to Secrets.swift and fill in values
/// from KEYS.md (also gitignored).
enum Secrets_Example {
    static let alpacaKeyID = "PK..."
    static let alpacaSecret = "..."
    static let massiveKey = "..."
    static let tarsCloudEndpoint = "https://..."
    static let tarsCloudKey = "..."
}
