"use strict";

var dataConfig = {
  dataInfos: [{
    resourceType: 'hws.resource.type.cce.cluster',
    keyConfigs: [{
      outputKey: 'productType',
      inputs: ['resourceType'],
      functions: [{
        inputs: ['resourceType'],
        funcType: 'rulesMap',
        params: {
          map: {
            'hws.resource.type.cce.cluster': 'dataInfo_13_'
          }
        }
      }]
    }, {
      outputKey: 'clusterType',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'cce.s(1|2).(small|medium|large|xlarge)': 'dataInfo_2_'
          }
        }
      }]
    }, {
      outputKey: 'clusterNodeScale',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'cce.s(1|2).small': 'dataInfo_50_',
            'cce.s(1|2).medium': 'dataInfo_200_',
            'cce.s(1|2).large': 'dataInfo_1000_',
            'cce.s(1|2).xlarge': 'dataInfo_2000_'
          }
        }
      }]
    }, {
      outputKey: 'clusterMasterScale',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'cce.s2.(small|medium|large|xlarge)': 'dataInfo_4_',
            'cce.s1.(small|medium|large|xlarge)': 'dataInfo_5_'
          }
        }
      }]
    }, {
      outputKey: 'clusterScaleId',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'cce.s(1|2).small': 'small',
            'cce.s(1|2).medium': 'medium',
            'cce.s(1|2).large': 'large',
            'cce.s(1|2).xlarge': 'xlarge'
          }
        }
      }]
    }, {
      outputKey: 'clusterAvailableId',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'cce.s2.(small|medium|large|xlarge)': 's2',
            'cce.s1.(small|medium|large|xlarge)': 's1'
          }
        }
      }]
    }]
  }, {
    resourceType: 'hws.resource.type.cce.autopilot',
    keyConfigs: [{
      outputKey: 'productType',
      inputs: ['resourceType'],
      functions: [{
        inputs: ['resourceType'],
        funcType: 'rulesMap',
        params: {
          map: {
            'hws.resource.type.cce.autopilot': 'dataInfo_36_'
          }
        }
      }]
    }, {
      outputKey: 'name',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'cce.autopilot.cluster': 'dataInfo_36_'
          }
        }
      }]
    }]
  }, {
    resourceType: 'hws.resource.type.cci.autopilot',
    keyConfigs: [{
      outputKey: 'productType',
      inputs: ['resourceType'],
      functions: [{
        inputs: ['resourceType'],
        funcType: 'rulesMap',
        params: {
          map: {
            'hws.resource.type.cci.autopilot': 'dataInfo_36_'
          }
        }
      }]
    }, {
      outputKey: 'gpu',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            '^autopilot.default.cpu.1000vCPU-hour.monthly$': 'calc_1_',
            '^autopilot.default.cpu.10000vCPU-hour.monthly$': 'calc_2_',
            '^autopilot.default.cpu.12000vCPU-hour.yearly$': 'calc_3_',
            '^autopilot.default.cpu.100000vCPU-hour.monthly$': 'calc_4_',
            '^autopilot.default.cpu.120000vCPU-hour.yearly$': 'calc_5_',
            '^autopilot.default.cpu.1200000vCPU-hour.yearly$': 'calc_6_',
            '^autopilot.default.mem.1000GB-hour.monthly$': 'calc_7_',
            '^autopilot.default.mem.10000GB-hour.monthly$': 'calc_8_',
            '^autopilot.default.mem.12000GB-hour.yearly$': 'calc_9_',
            '^autopilot.default.mem.100000GB-hour.monthly$': 'calc_10_',
            '^autopilot.default.mem.120000GB-hour.yearly$': 'calc_11_',
            '^autopilot.default.mem.1200000GB-hour.yearly$': 'calc_12_'
          }
        }
      }]
    }, {
      outputKey: 'cciType',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            '^autopilot.default.(cpu|mem).': 'calc_17_'
          }
        }
      }]
    }, {
      outputKey: 'specType',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            '^autopilot.default.cpu.': 'calc_14_',
            '^autopilot.default.mem.': 'calc_15_'
          }
        }
      }]
    }, {
      outputKey: 'billingCycle',
      outputValue: 'dataInfo_46_'
    }, {
      outputKey: 'tableUnit',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'autopilot.container.cpu': 'dataInfo_47_',
            'autopilot.container.mem': 'dataInfo_48_'
          }
        }
      }]
    }, {
      outputKey: 'name',
      inputs: ['resourceSpecCode'],
      functions: [{
        inputs: ['resourceSpecCode'],
        funcType: 'rulesMap',
        params: {
          map: {
            'autopilot.container.cpu': 'CPU',
            'autopilot.container.mem': 'dataInfo_49_'
          }
        }
      }]
    }]
  }],
  dataSources: [{
    ids: ['calculator_clustertype_radio'],
    sources: [{
      param: 'hws.resource.type.cce.cluster'
    }, {
      param: 'hws.resource.type.cce.autopilot',
      rules: [{
        resourceSpecCode: '^cce.autopilot.cluster$'
      }]
    }, {
      param: 'hws.resource.type.cci.autopilot',
      rules: [{
        resourceSpecCode: '^autopilot.default.[\\S]*.(monthly|yearly)'
      }]
    }]
  }, {
    ids: ['priceDetail_clusterprice_table'],
    sources: [{
      param: 'hws.resource.type.cce.cluster',
      rules: [{
        resourceSpecCode: 'cce.s(1|2).(small|medium|large|xlarge)'
      }]
    }]
  }, {
    ids: ['priceDetail_charge_tip'],
    sources: [{
      param: 'dataInfo_35_'
    }, {
      param: 'dataInfo_34_'
    }]
  }, {
    ids: ['calculator_vCPUs_stepper'],
    cascadedSource: {
      inputs: ['calculator_clustertype_radio', 'hws.resource.type.cci.autopilot'],
      function: function _function(source, source1) {
        var _source$;
        if (((_source$ = source[0]) === null || _source$ === void 0 ? void 0 : _source$.productType) === 'dataInfo_36_') {
          return source1.filter(function (item) {
            return item.resourceSpecCode === "autopilot.container.cpu";
          });
        }
        return [];
      }
    }
  }, {
    ids: ['calculator_mem_stepper'],
    cascadedSource: {
      inputs: ['calculator_clustertype_radio', 'hws.resource.type.cci.autopilot'],
      function: function _function(source, source1) {
        var _source$2;
        if (((_source$2 = source[0]) === null || _source$2 === void 0 ? void 0 : _source$2.productType) === 'dataInfo_36_') {
          return source1.filter(function (item) {
            return item.resourceSpecCode === "autopilot.container.mem";
          });
        }
        return [];
      }
    }
  }, {
    ids: ['priceDetail_cceSpec_switch'],
    sources: [{
      param: 'hws.resource.type.cce.cluster'
    }, {
      param: 'hws.resource.type.cce.autopilot'
    }, {
      param: 'hws.resource.type.cci.autopilot',
      rules: [{
        resourceSpecCode: '^autopilot.default.(cpu|mem).[\\S]*.(monthly|yearly)'
      }]
    }]
  }, {
    ids: ['priceDetail_cceResource_table'],
    cascadedSource: {
      inputs: ['priceDetail_cceAutopilot_switch', 'hws.resource.type.cci.autopilot', 'hws.resource.type.cce.autopilot'],
      function: function _function(source, source1, source2) {
        var reg = /^autopilot.container.(cpu|mem)$/;
        if (source2.length) {
          return source1.filter(function (item) {
            return reg.test(item.resourceSpecCode);
          });
        }
        return [];
      }
    }
  }, {
    ids: ['priceDetail_cceBundle1_table'],
    sources: [{
      param: 'hws.resource.type.cci.autopilot',
      rules: [{
        resourceSpecCode: '^autopilot.default.(cpu|mem).[\\S]*.(monthly|yearly)'
      }]
    }]
  }, {
    ids: ['priceDetail_cceAutopilot_switch'],
    sources: [{
      param: 'calc_17_'
    }]
  }, {
    ids: ['priceDetail_cceAutopilot_table'],
    sources: [{
      param: 'hws.resource.type.cce.autopilot',
      rules: [{
        resourceSpecCode: '^cce.autopilot.cluster$'
      }]
    }]
  }]
};
function createTableStrictBundleCpu(id) {
  var basePermutationsConfig = [{
    0: 'calc_1_',
    1: 'calc_21_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.cpu.1000vCPU-hour.monthly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_2_',
    1: 'calc_21_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.cpu.10000vCPU-hour.monthly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_3_',
    1: 'calc_20_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.cpu.12000vCPU-hour.yearly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_4_',
    1: 'calc_21_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.cpu.100000vCPU-hour.monthly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_5_',
    1: 'calc_20_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.cpu.120000vCPU-hour.yearly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_6_',
    1: 'calc_20_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.cpu.1200000vCPU-hour.yearly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_7_',
    1: 'calc_21_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.mem.1000GB-hour.monthly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_8_',
    1: 'calc_21_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.mem.10000GB-hour.monthly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_9_',
    1: 'calc_20_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.mem.12000GB-hour.yearly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_10_',
    1: 'calc_21_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.mem.100000GB-hour.monthly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_11_',
    1: 'calc_20_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.mem.120000GB-hour.yearly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }, {
    0: 'calc_12_',
    1: 'calc_20_',
    2: {
      identity: {
        resourceSpecCode: 'autopilot.default.mem.1200000GB-hour.yearly',
        billingEvent: 'event.type.onetime'
      },
      target: 'amount'
    },
    3: 'calc_19_'
  }];
  return {
    id: id,
    type: 'FuncTableStrict',
    title: 'calc_23_',
    dataSets: [{
      titles: ['calc_24_', 'calc_25_', 'calc_26_', 'calc_27_'],
      permutations: basePermutationsConfig
    }]
  };
}
var viewConfig = {
  calc_view: {
    productInfoUrls: [{
      lang: 'zh-cn',
      url: ''
    }, {
      lang: 'en-us',
      url: ''
    }, {
      lang: 'es-us',
      url: ''
    }],
    components: [{
      id: 'calculator_clustertype_radio',
      type: 'CommonRadioGroup',
      optionKeys: ['productType', 'clusterType', 'clusterNodeScale', 'clusterMasterScale', 'cciType', 'specType', 'gpu'],
      titles: ['dataInfo_15_', 'dataInfo_0_', 'dataInfo_1_', 'dataInfo_6_', 'calc_16_', 'calc_13_'],
      sortMethods: [['dataInfo_13_', 'dataInfo_36_'], ['dataInfo_2_'], ['dataInfo_50_', 'dataInfo_200_', 'dataInfo_1000_', 'dataInfo_2000_'], ['dataInfo_4_', 'dataInfo_5_']]
    }, {
      id: "calculator_vCPUs_stepper",
      type: "CommonStepper",
      title: "dataInfo_38_",
      prefixs: [{
        measureId: 4,
        max: 10000,
        min: 0,
        defaultValue: 0,
        step: 1,
        measureName: "dataInfo_39_",
        measurePluralName: "dataInfo_39_"
      }]
    }, {
      id: "calculator_mem_stepper",
      type: "CommonStepper",
      title: "dataInfo_40_",
      prefixs: [{
        measureId: 10,
        max: 10000,
        min: 0,
        defaultValue: 0,
        step: 1,
        measureName: "dataInfo_41_",
        measurePluralName: "dataInfo_41_"
      }]
    }, {
      id: 'global_QUANTITY',
      prefixs: [{
        measureId: 41,
        max: 999,
        min: 1,
        defaultValue: 1
      }]
    }],
    showConfigs: [{
      ids: ['global_QUANTITY'],
      chargeMode: 'PERIOD'
    }]
  },
  detail_view: {
    priceInfoUrls: [{
      lang: 'zh-cn',
      url: ''
    }, {
      lang: 'en-us',
      url: ''
    }, {
      lang: 'es-us',
      url: ''
    }],
    components: [
    // 产品分类
    {
      id: 'priceDetail_cceSpec_switch',
      type: 'CommonSwitch',
      title: 'dataInfo_15_',
      optionKey: "productType",
      sortMethod: ['dataInfo_13_', 'dataInfo_36_']
    },
    // CCE Autopilot集群管理
    {
      id: 'priceDetail_cceAutopilot_table',
      type: 'CommonTable',
      title: 'calc_28_',
      column: {
        titles: ['dataInfo_44_'],
        optionKeys: ['name'],
        planList: ['ONDEMAND_1'],
        unit: "dataInfo_37_",
        unitTitle: "calc_27_"
      }
    },
    // 类型
    {
      id: 'priceDetail_cceAutopilot_switch',
      type: 'CommonSwitch',
      title: 'calc_16_',
      sortMethod: ['calc_17_', 'calc_18_']
    },
    // 按需计费模式
    {
      id: 'priceDetail_cceResource_table',
      type: 'CommonTable',
      title: 'dataInfo_43_',
      column: {
        discountIcons: [false],
        titles: ['dataInfo_44_', 'dataInfo_45_'],
        optionKeys: ['name', 'billingCycle'],
        planList: ['ONDEMAND_1'],
        planListTitles: ['dataInfo_14_'],
        sortMethods: {
          name: ['CPU', 'dataInfo_49_']
        }
      }
    },
    // 按需套餐包
    createTableStrictBundleCpu('priceDetail_cceBundle1_table'), {
      id: 'priceDetail_clusterprice_table',
      type: 'CommonTable',
      blockLines: ['top', 'bottom'],
      title: 'dataInfo_10_',
      column: {
        titles: ['dataInfo_0_', 'dataInfo_1_', 'dataInfo_6_'],
        optionKeys: ['clusterType', 'clusterNodeScale', 'clusterMasterScale'],
        sortMethods: {
          clusterNodeScale: [],
          clusterMasterScale: ['dataInfo_5_', 'dataInfo_4_']
        },
        unit: 'dataInfo_11_'
      }
    }, {
      id: 'priceDetail_cceAgilePrice_table',
      type: 'CommonTable',
      blockLines: ['top', 'bottom'],
      filters: {
        titles: ['dataInfo_16_'],
        optionKeys: ['cceAgileProductType'],
        sortMethods: [['dataInfo_17_', 'dataInfo_18_', 'dataInfo_19_']]
      },
      column: {
        titles: ['dataInfo_16_', 'dataInfo_20_'],
        optionKeys: ['cceAgileProductType', 'specificationType'],
        unit: 'dataInfo_11_',
        priceUnitTitle: 'currency'
      }
    }, {
      id: 'priceDetail_charge_tip',
      type: 'CommonTip',
      titlePosition: 'top'
    }],
    // 页面视图组件展示控制
    showConfigs: [{
      ids: ['priceDetail_clusterprice_table', 'priceDetail_charge_tip'],
      switchs: [{
        id: 'priceDetail_cceSpec_switch',
        values: ['dataInfo_13_']
      }]
    }, {
      ids: ['priceDetail_cceResource_table', 'priceDetail_cceAutopilot_switch', 'priceDetail_cceBundle1_table', 'priceDetail_cceAutopilot_table'],
      switchs: [{
        id: 'priceDetail_cceSpec_switch',
        values: ['dataInfo_36_']
      }]
    }]
  }
};
var funcConfig = {
  calc: {
    buyUrls: [{
      baseUrl: 'https://console-intl.huaweicloud.com/cce2.0/{globalParams}#/cce/create/cluster{selfParams}',
      rules: {
        resourceSpecCode: 'cce.s(1|2).(small|medium|large|xlarge)'
      },
      params: [{
        key: 'category',
        //
        value: {
          inputs: ["calculator_clustertype_radio"],
          function: function _function(input) {
            return "cce";
          }
        }
      }, {
        key: 'billingType',
        // 创建集群计费模式 demand  按需计费  period包年包月计费模式	默认按需	type = demand
        value: {
          inputs: ['global_REGIONINFO'],
          function: function _function(input) {
            return input.chargeMode === 'PERIOD' ? 'period' : 'demand';
          }
        }
      }, {
        key: 'scale',
        // 集群规模 small 50节点 、medium 200 节点 、large 1000 节点、 xlarge 2000 节点 集群规模	默认最小规模	scale = small
        value: {
          id: 'calculator_clustertype_radio',
          optionKey: 'clusterScaleId'
        }
      }, {
        key: 'masterNum',
        //  masterNum	是否高可用 / 集群master实例数 s1 单master、s2 3master s3 5master 集群master实例数	支持高可用的场景，默认为3master	masterNum = s1
        value: {
          id: 'calculator_clustertype_radio',
          optionKey: 'clusterAvailableId'
        }
      }, {
        key: "periodNum",
        // periodNum	包年包月场景，购买时长数量 1 - 9 //1到9个月 1 - 3  // 1-3年购买的月数年数	默认一个月	购买时长1年：
        value: {
          inputs: ["global_PERIODTIME"],
          function: function _function(input) {
            console.log(input);
            if (!input) {
              return "";
            }
            if (input) {
              return input.measureValue;
            }
          }
        }
      }, {
        key: "periodType",
        // periodType	包年包月场景 2 包月 、3包年 购买时长是年还是月	默认一个月	购买时长两个月：periodType = 2 & periodNum=2
        value: {
          inputs: ["global_PERIODTIME"],
          function: function _function(input) {
            if (!input) {
              return "";
            }
            return input.measureId === 19 ? "3" : "2";
          }
        }
      }]
    }, {
      baseUrl: 'https://console-intl.huaweicloud.com/cce2.0/{globalParams}#/cce/create/cluster{selfParams}',
      rules: {
        resourceSpecCode: 'cce.autopilot.cluster'
      },
      params: [{
        key: 'category',
        //
        value: {
          inputs: ["calculator_clustertype_radio"],
          function: function _function(input) {
            return "Autopilot";
          }
        }
      }]
    }, {
      baseUrl: 'https://console-intl.huaweicloud.com/cce2.0/{globalParams}#/cce/create/bundle{selfParams}',
      rules: {
        resourceSpecCode: 'autopilot.default.(mem|cpu).'
      },
      params: [{
        key: 'type',
        value: {
          id: 'calculator_clustertype_radio',
          optionKey: 'resourceSpecCode'
        }
      }]
    }],
    parseSelectProduct: [{
      id: 'calculator_mem_stepper',
      inputs: ['calculator_mem_stepper'],
      function: function _function(source1) {
        source1.forEach(function (data) {
          data.cpqPurchaseDuration = data.usageValue * 3600;
        });
        return source1;
      }
    }, {
      id: 'calculator_vCPUs_stepper',
      inputs: ['calculator_vCPUs_stepper'],
      function: function _function(source1) {
        source1.forEach(function (data) {
          data.cpqPurchaseDuration = data.usageValue * 3600;
        });
        return source1;
      }
    }]
  }
};
var lang = {
  "dataInfo_0_": "Cluster Type",
  "dataInfo_1_": "Cluster Scale",
  "dataInfo_2_": "Standard/Turbo",
  "dataInfo_50_": "50 nodes",
  "dataInfo_200_": "200 nodes",
  "dataInfo_1000_": "1000 nodes",
  "dataInfo_2000_": "2000 nodes",
  "dataInfo_4_": "3 Masters",
  "dataInfo_5_": "Single",
  "dataInfo_6_": "Master Nodes",
  "dataInfo_7_": "Hourly",
  "dataInfo_8_": "Monthly",
  "dataInfo_9_": "1 Year",
  "dataInfo_10_": "Cluster",
  "dataInfo_11_": "USD",
  "dataInfo_12_": "MCP CCE Agile",
  "dataInfo_13_": "CCE cluster",
  "dataInfo_14_": "Price",
  "dataInfo_15_": "Product Category",
  "dataInfo_30_": "Special Discount",
  "dataInfo_31_": "1. The price is an estimate and may differ from the final price.",
  "dataInfo_32_": "2. When resource usage is calculated using the pay-per-use billing mode, decimal numerals are rounded off and accurate to two decimal places. For example, if the estimated price is less than $0.01 USD (after rounding off), $0.01 USD will be displayed.",
  "dataInfo_33_": "<p style='color: #C7000B'>3. The price represents the cluster management fee, and the node fee will be settled based on the node purchase price.</p>",
  "dataInfo_34_": "<p style='color: #C7000B'>The CCE cluster price indicates the management fee corresponding to the cluster management scale, and the user node fee will be settled based on the node purchase price.</p>",
  "dataInfo_35_": "<p style='font-size: 14px; color: #666; margin-bottom: 5px;'>Billing instructions</p>",
  "dataInfo_36_": "CCE Autopilot cluster",
  "dataInfo_37_": "USD/Cluster",
  "dataInfo_38_": "CPU",
  "dataInfo_39_": "vCPU",
  "dataInfo_40_": "Memory",
  "dataInfo_41_": "GiB",
  "dataInfo_42_": "GPU Packages",
  "dataInfo_43_": "Pay-per-Use",
  "dataInfo_44_": "Resource",
  "dataInfo_45_": "Billing Mode",
  "dataInfo_46_": "Hourly",
  "dataInfo_47_": "Price per vCPU-second",
  "dataInfo_48_": "Price per GiB-second",
  "dataInfo_49_": "mem",
  "calc_1_": "General Computing 1,000 vCPU-hours CPU Monthly Package",
  "calc_2_": "General Computing 10,000 vCPU-hours CPU Monthly Package",
  "calc_3_": "General Computing 12,000 vCPU-hours CPU Yearly Package",
  "calc_4_": "General Computing 100,000 vCPU-hours CPU Monthly Package",
  "calc_5_": "General Computing 120,000 vCPU-hours CPU Yearly Package",
  "calc_6_": "General Computing 1,200,000 vCPU-hours CPU Yearly Package",
  "calc_7_": "General Computing 1,000 GiB-hours Memory Monthly Package",
  "calc_8_": "General Computing 10,000 GiB-hours Memory Monthly Package",
  "calc_9_": "General Computing 12,000 GiB-hours Memory Yearly Package",
  "calc_10_": "General Computing 100,000 GiB-hours Memory Monthly Package",
  "calc_11_": "General Computing 120,000 GiB-hours Memory Yearly Package",
  "calc_12_": "General Computing 1,200,000 GiB-hours Memory Yearly Package",
  "calc_13_": "Package",
  "calc_14_": "CPU Packages",
  "calc_15_": "Memory Packages",
  "calc_16_": "Type",
  "calc_17_": " General computing",
  "calc_18_": " GPU-accelerated",
  "calc_19_": "USD",
  "calc_20_": "1year",
  "calc_21_": "1month",
  "calc_22_": "Hourly",
  "calc_23_": "Package Price",
  "calc_24_": "Package",
  "calc_25_": "Validity Period",
  "calc_26_": "Price",
  "calc_27_": "Currency",
  "calc_28_": "Cluster management fee"
};
var urlPath = 'cce';