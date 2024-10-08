group "default" {
  targets = ["t3"]
}

target "t3" {
  name = "${item.tag}"
  matrix = {
    item = t3
  }
  args = {
    VERSION = "${item.version}"
    DUMMY_ARG = "${item.arg}"
  }
  tags = ["${item.tag}"]
}
