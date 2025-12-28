import { DriveFile } from '@/models/entities/drive-file.js';
import { InternalStorage } from './internal-storage.js';
import { DriveFiles, Instances } from '@/models/index.js';
import { driveChart, perUserDriveChart, instanceChart } from '@/services/chart/index.js';
import { createDeleteObjectStorageFileJob } from '@/queue/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { getS3 } from './s3.js';
import { v4 as uuid } from 'uuid';

export async function deleteFile(file: DriveFile, isExpired = false) {
	if (file.storedInternal) {
		const mainFileRefCount = await DriveFiles.countBy({ accessKey: file.accessKey! });
		if (mainFileRefCount <= 1) {
			InternalStorage.del(file.accessKey!);
		}

		if (file.thumbnailUrl) {
			const thumbnailRefCount = await DriveFiles.countBy({ thumbnailAccessKey: file.thumbnailAccessKey! });
			if (thumbnailRefCount <= 1) {
				InternalStorage.del(file.thumbnailAccessKey!);
			}
		}

		if (file.webpublicUrl) {
			const webpublicRefCount = await DriveFiles.countBy({ webpublicAccessKey: file.webpublicAccessKey! });
			if (webpublicRefCount <= 1) {
				InternalStorage.del(file.webpublicAccessKey!);
			}
		}
	} else if (!file.isLink) {
		const mainFileRefCount = await DriveFiles.countBy({ accessKey: file.accessKey! });
		if (mainFileRefCount <= 1) {
			createDeleteObjectStorageFileJob(file.accessKey!);
		}

		if (file.thumbnailUrl) {
			const thumbnailRefCount = await DriveFiles.countBy({ thumbnailAccessKey: file.thumbnailAccessKey! });
			if (thumbnailRefCount <= 1) {
				createDeleteObjectStorageFileJob(file.thumbnailAccessKey!);
			}
		}

		if (file.webpublicUrl) {
			const webpublicRefCount = await DriveFiles.countBy({ webpublicAccessKey: file.webpublicAccessKey! });
			if (webpublicRefCount <= 1) {
				createDeleteObjectStorageFileJob(file.webpublicAccessKey!);
			}
		}
	}

	postProcess(file, isExpired);
}

export async function deleteFileSync(file: DriveFile, isExpired = false) {
	if (file.storedInternal) {
		const mainFileRefCount = await DriveFiles.countBy({ accessKey: file.accessKey! });
		if (mainFileRefCount <= 1) {
			InternalStorage.del(file.accessKey!);
		}

		if (file.thumbnailUrl) {
			const thumbnailRefCount = await DriveFiles.countBy({ thumbnailAccessKey: file.thumbnailAccessKey! });
			if (thumbnailRefCount <= 1) {
				InternalStorage.del(file.thumbnailAccessKey!);
			}
		}

		if (file.webpublicUrl) {
			const webpublicRefCount = await DriveFiles.countBy({ webpublicAccessKey: file.webpublicAccessKey! });
			if (webpublicRefCount <= 1) {
				InternalStorage.del(file.webpublicAccessKey!);
			}
		}
	} else if (!file.isLink) {
		const promises = [];

		const mainFileRefCount = await DriveFiles.countBy({ accessKey: file.accessKey! });
		if (mainFileRefCount <= 1) {
			promises.push(deleteObjectStorageFile(file.accessKey!));
		}

		if (file.thumbnailUrl) {
			const thumbnailRefCount = await DriveFiles.countBy({ thumbnailAccessKey: file.thumbnailAccessKey! });
			if (thumbnailRefCount <= 1) {
				promises.push(deleteObjectStorageFile(file.thumbnailAccessKey!));
			}
		}

		if (file.webpublicUrl) {
			const webpublicRefCount = await DriveFiles.countBy({ webpublicAccessKey: file.webpublicAccessKey! });
			if (webpublicRefCount <= 1) {
				promises.push(deleteObjectStorageFile(file.webpublicAccessKey!));
			}
		}

		await Promise.all(promises);
	}

	postProcess(file, isExpired);
}

async function postProcess(file: DriveFile, isExpired = false) {
	// リモートファイル期限切れ削除後は直リンクにする
	if (isExpired && file.userHost !== null && file.uri != null) {
		DriveFiles.update(file.id, {
			isLink: true,
			url: file.uri,
			thumbnailUrl: null,
			webpublicUrl: null,
			storedInternal: false,
			// ローカルプロキシ用
			accessKey: uuid(),
			thumbnailAccessKey: 'thumbnail-' + uuid(),
			webpublicAccessKey: 'webpublic-' + uuid(),
		});
	} else {
		DriveFiles.delete(file.id);
	}

	// 統計を更新
	driveChart.update(file, false);
	perUserDriveChart.update(file, false);
	if (file.userHost !== null) {
		instanceChart.updateDrive(file, false);
	}
}

export async function deleteObjectStorageFile(key: string) {
	const meta = await fetchMeta();

	const s3 = getS3(meta);

	await s3.deleteObject({
		Bucket: meta.objectStorageBucket!,
		Key: key,
	}).promise();
}
