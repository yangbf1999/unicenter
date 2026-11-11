# UniSphere 节点热迁移准备

热迁移功能由 UniCenter 控制面调用 UniSphere 节点执行。社区版发行时，
UniSphere 以官方 ISO 镜像随 UniCenter 一起提供下载；官方地址确认后，
请从发行说明中的链接下载并安装对应版本。本文只说明 UniCenter 需要的
节点准备项，不分发底层平台的闭源组件。

## 下载并安装 UniSphere

1. 从 UniCenter 社区版发行说明中的 **UniSphere 官方 ISO 下载链接** 获取
   ISO（链接待确认后补充）。
2. 按 ISO 随附的安装说明完成节点安装、网络配置和存储配置。
3. 将节点管理地址、API 凭据和可用于热迁移的目标存储录入 UniCenter。

每个作为热迁移目标的节点都需要完成一次下面的运行时准备。命令应以
`root` 身份在目标节点执行。不同 UniSphere ISO 版本的系统软件包名可能
不同，优先使用 ISO 自带的软件源和发行说明，不要混用其他平台的软件源。

## 运行时依赖

| 组件 | 用途 |
| --- | --- |
| `nbdkit` | 提供 NBD 服务 |
| `nbd-client` | 在节点上挂载 NBD 设备 |
| `nbdkit-plugin-vddk` | 读取 VMware VDDK 磁盘 |
| Broadcom VDDK (`libvixDiskLib.so*`) | VMware 虚拟磁盘访问库 |
| `nbd` 内核模块 | 暴露热迁移目标块设备 |

使用 UniSphere ISO 的软件包管理器安装 `nbdkit`、`nbd-client` 和
`nbdkit-plugin-vddk`。如果当前 ISO 未预置这些包，请按照该 ISO 对应的
官方发行说明启用软件源；本文不提供第三方源地址。

## 安装 Broadcom VDDK

VDDK 由 Broadcom 按其许可协议提供，UniCenter 不随源码或 ISO 再分发。
请使用 Broadcom 官方下载入口，并在接受其许可后将 Linux x86_64 版本
安装到节点：

<https://developer.broadcom.com/sdks/vmware-virtual-disk-development-kit-vddk/latest/>

默认目录为 `/usr/lib/vmware-vix-disklib`。安装完成后确认
`lib64/libvixDiskLib.so*` 存在，并执行 `ldconfig`。

## 加载 NBD 模块

```bash
modprobe nbd max_part=0
echo nbd > /etc/modules-load.d/unisphere-nbd.conf
printf 'options nbd max_part=0\n' > /etc/modprobe.d/unisphere-nbd.conf
```

## 验证节点

先在节点上验证插件可以加载 VDDK：

```bash
nbdkit vddk libdir=/usr/lib/vmware-vix-disklib --dump-plugin
```

然后在 UniCenter 中打开 VMware 虚拟机的迁移对话框，选择 **热迁移**
并选择该 UniSphere 节点。预检显示“目标节点已准备好热迁移”后，才可以
启动任务；如果缺少依赖，页面会列出缺失项并阻止启动。

## 存储与网络要求

- 热迁移目标必须是原始块存储，支持 LVM、LVM-thin、ZFS 或 Ceph RBD。
- 保存 qcow2 文件的普通目录或 NFS 不支持按块写入，请改用冷迁移。
- 目标节点必须能访问 VMware 源主机的 TCP 443 和 902 端口。
- 自定义 VDDK 目录可以由引擎和预检使用；迁移页面默认查找
  `/usr/lib/vmware-vix-disklib`，除非产品配置另有说明。
