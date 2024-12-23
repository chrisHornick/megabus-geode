#!/bin/bash
echo "starting locator on ${HOSTNAME}"

DNS_TIMEOUT=${DNS_TIMEOUT:=60}
echo "waiting up to ${DNS_TIMEOUT}s for ${LOCATOR} to resolve"
DNS_IP=""
COUNTER=0
while [ -z ${DNS_IP} ] && [ ${COUNTER} -lt ${DNS_TIMEOUT} ]; do
  DNS_IP=$(getent hosts ${LOCATOR} | awk '{ print $1 }')
  [ -z "${DNS_IP}" ] && sleep 1
  ((COUNTER++))
done
if [[ -z "${DNS_IP}" ]]
then
    echo "timeout waiting for ${LOCATOR} to resolve"
    exit 1
else
    echo "${LOCATOR} resolved to ${DNS_IP}"
fi

gfsh start locator --name=${HOSTNAME} --mcast-port=0 ${START_ARGS} --locators=${LOCATOR}[${LOCATOR_PORT:=10334}] --log-level=${LOG_LEVEL:=config} --http-service-port=0

tail -f ${HOSTNAME}/${HOSTNAME}.log
