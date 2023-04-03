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
