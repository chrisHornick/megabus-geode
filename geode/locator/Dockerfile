FROM apachegeode/geode:1.0.0-incubating

EXPOSE 1024 1099 7070 10334

WORKDIR /root

COPY entrypoint.sh .

HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 CMD gfsh status locator --host=127.0.0.1 | grep "is currently online"

ENTRYPOINT ["./entrypoint.sh"]
