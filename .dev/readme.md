https://github.com/homoluctus/slatify/
https://github.com/technote-space/toc-generator/commit/06ca2702bc545e4c2a31bc8b6cfd052de59b0af5/checks?check_suite_id=250009775
https://github.com/technote-space/release-github-actions


docker buildx rm builder
docker run --rm --privileged multiarch/qemu-user-static:register --reset -p yes --credential yes
docker buildx create --name builder --driver docker-container --use
docker buildx inspect --bootstrap

docker buildx build --platform linux/amd64,linux/arm/v6,linux/arm/v7,linux/arm64,linux/386,linux/ppc64le,linux/s390x --output "type=image,push=false" -t buildx --file ./test/Dockerfile-sudo ./test
