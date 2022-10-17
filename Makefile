LOCAL_IP_ADDR := saiph

serve:
	zola serve -i 0.0.0.0 -u $(LOCAL_IP_ADDR)

build:
	zola build

deploy:
	git tag -a -f live
	git push origin live --force
