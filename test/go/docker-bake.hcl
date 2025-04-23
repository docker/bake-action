target "docker-metadata-action" {}

variable "DESTDIR" {
  default = "/tmp/bake-build"
}

group "default" {
  targets = ["binary"]
}

target "binary" {
  target = "binary"
  output = [DESTDIR]
}

target "image" {
  target = "image"
  tags = ["localhost:5000/name/app:latest"]
}

target "image-all" {
  inherits = ["binary"]
  platforms = [
    "linux/amd64",
    "linux/arm64",
    "linux/arm/v7",
    "linux/arm/v6"
  ]
}
