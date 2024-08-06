group "default" {
  targets = ["lint", "lint-other", "lint-inline"]
}
target "lint" {
  dockerfile = "lint.Dockerfile"
}
target "lint-other" {
  dockerfile = "lint-other.Dockerfile"
}
target "lint-inline" {
  dockerfile-inline = "FRoM alpine\nENTRYPOINT [\"echo\", \"hello\"]"
}
